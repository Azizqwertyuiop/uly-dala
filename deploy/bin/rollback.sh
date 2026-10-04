#!/usr/bin/env bash
# Откат (docs/deploy.md, цель — меньше минуты):
#   /srv/uly-dala/bin/rollback.sh            — на релиз во втором слоте (он ещё работает: секунды)
#   /srv/uly-dala/bin/rollback.sh <id>       — на любой сохранённый релиз (запуск ~5–10 с)
#   /srv/uly-dala/bin/rollback.sh --list     — какие релизы есть
# Тот же путь, что у выкладки: проверка /api/health до переключения трафика.
source "$(dirname "$0")/lib.sh"

if [ "${1:-}" = "--list" ]; then
  current="$(active_slot)"
  echo "работает: $(slot_release "${current:-none}") (слот ${current:-—}); второй слот: $(slot_release "$(other_slot "${current:-3001}")")"
  echo "сохранённые релизы (новые сверху):"; ls -1t "$ULY_ROOT/releases"
  exit 0
fi

target="${1:-}"
if [ -z "$target" ]; then
  current="$(active_slot)"
  [ -n "$current" ] || die "нет активного слота — откатывать нечего"
  target="$(slot_release "$(other_slot "$current")")"
  [ "$target" != "none" ] || die "во втором слоте нет релиза; укажите id: rollback.sh --list"
fi

start=$(date +%s)
log "откат на $target"
activate "$target"
log "откат завершён за $(( $(date +%s) - start )) с"
