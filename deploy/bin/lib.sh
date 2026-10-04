#!/usr/bin/env bash
# Общие функции выкладки (docs/deploy.md). Подключается из release.sh, rollback.sh, preview.sh.
#
# Схема на сервере (по умолчанию ULY_ROOT=/srv/uly-dala):
#   releases/<id>/        распакованные релизы (последние KEEP_RELEASES)
#   slots/3001, slots/3002  ссылки на релизы; два сервера работают одновременно (blue/green)
#   active                порт слота, на который сейчас смотрит Caddy
#   cdn/                  общее хранилище статики с хешем в имени (без удаления старого)
#   deploys.log           журнал: время, действие, релиз, слот
#
# Для проверки вне сервера (scripts/verify-rollback.mjs) всё внешнее переопределяется:
#   ULY_ROOT, ULY_SERVICE (как запускать/останавливать слот), ULY_PROXY_FILE, ULY_PROXY_RELOAD.

set -euo pipefail

ULY_ROOT="${ULY_ROOT:-/srv/uly-dala}"
ULY_PROXY_FILE="${ULY_PROXY_FILE:-/etc/caddy/uly-dala/upstream.caddy}"
ULY_PROXY_RELOAD="${ULY_PROXY_RELOAD:-sudo systemctl reload caddy}"
ULY_SERVICE="${ULY_SERVICE:-systemd}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-30}"
SLOTS=(3001 3002)

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$ULY_ROOT/deploys.log" >&2; }
die() { echo "ОШИБКА: $*" >&2; exit 1; }

active_slot() { cat "$ULY_ROOT/active" 2>/dev/null || echo ""; }
other_slot() { [ "$1" = "${SLOTS[0]}" ] && echo "${SLOTS[1]}" || echo "${SLOTS[0]}"; }
slot_release() { basename "$(readlink "$ULY_ROOT/slots/$1" 2>/dev/null || echo none)"; }

# Запуск/перезапуск/остановка сервера слота.
service() { # service start|stop <port>
  local action="$1" port="$2"
  if [ "$ULY_SERVICE" = "systemd" ]; then
    if [ "$action" = "start" ]; then
      sudo systemctl enable "uly-dala@$port" >/dev/null 2>&1 || true
      sudo systemctl restart "uly-dala@$port"
    else
      sudo systemctl stop "uly-dala@$port"
    fi
  else
    "$ULY_SERVICE" "$action" "$port" "$ULY_ROOT/slots/$port"
  fi
}

# Ждать, пока слот ответит 200 на /api/health с нужным релизом.
wait_healthy() { # wait_healthy <port> <release>
  local port="$1" release="$2" body
  for _ in $(seq 1 $((HEALTH_TIMEOUT * 5))); do
    body="$(curl -fsS --max-time 2 "http://127.0.0.1:$port/api/health" 2>/dev/null || true)"
    if [[ "$body" == *"\"status\":\"ok\""* && "$body" == *"\"release\":\"$release\""* ]]; then return 0; fi
    sleep 0.2
  done
  return 1
}

# Направить Caddy на слот: файл с адресом сервера + мягкая перезагрузка (соединения не рвутся).
point_proxy() { # point_proxy <port>
  printf 'reverse_proxy 127.0.0.1:%s\n' "$1" > "$ULY_PROXY_FILE.tmp"
  mv "$ULY_PROXY_FILE.tmp" "$ULY_PROXY_FILE"
  eval "$ULY_PROXY_RELOAD"
  echo "$1" > "$ULY_ROOT/active"
}

# Сделать релиз рабочим: запустить его в свободном слоте, проверить, переключить трафик.
# Прежний слот остаётся запущенным — откат на него мгновенный (rollback.sh).
activate() { # activate <release>
  local release="$1" current next
  [ -d "$ULY_ROOT/releases/$release" ] || die "релиза $release нет в $ULY_ROOT/releases"
  current="$(active_slot)"
  if [ -n "$current" ] && [ "$(slot_release "$current")" = "$release" ]; then
    log "уже работает: $release (слот $current)"; return 0
  fi
  next="$(other_slot "${current:-${SLOTS[1]}}")"
  if [ "$(slot_release "$next")" != "$release" ] || ! wait_healthy_once "$next" "$release"; then
    ln -sfn "$ULY_ROOT/releases/$release" "$ULY_ROOT/slots/$next"
    service start "$next"
    if ! wait_healthy "$next" "$release"; then
      service stop "$next" || true
      die "релиз $release не прошёл проверку /api/health — трафик не переключён, работает прежний"
    fi
  fi
  point_proxy "$next"
  log "активен: $release (слот $next, прежний слот ${current:-—}: $(slot_release "${current:-none}"))"
}

wait_healthy_once() { HEALTH_TIMEOUT=1 wait_healthy "$@"; }

# Удалить старые релизы, кроме последних KEEP_RELEASES и тех, что стоят в слотах.
prune_releases() {
  local keep in_use
  in_use="$(slot_release "${SLOTS[0]}") $(slot_release "${SLOTS[1]}")"
  keep="$(ls -1t "$ULY_ROOT/releases" | head -n "$KEEP_RELEASES")"
  for r in $(ls -1t "$ULY_ROOT/releases"); do
    if ! grep -qx "$r" <<<"$keep" && [[ " $in_use " != *" $r "* ]]; then
      rm -rf "${ULY_ROOT:?}/releases/$r"; log "удалён старый релиз $r"
    fi
  done
}
