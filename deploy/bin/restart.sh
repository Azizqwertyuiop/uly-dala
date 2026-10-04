#!/usr/bin/env bash
# Перезапуск без простоя (после правки /etc/uly-dala/production.env — токены, SMTP, Sentry):
# тот же релиз запускается во втором слоте с новыми переменными, проверяется и получает трафик.
#   /srv/uly-dala/bin/restart.sh
source "$(dirname "$0")/lib.sh"
current="$(active_slot)"
[ -n "$current" ] || die "сайт ещё не выложен"
release="$(slot_release "$current")"
next="$(other_slot "$current")"
ln -sfn "$ULY_ROOT/releases/$release" "$ULY_ROOT/slots/$next"
service start "$next"
wait_healthy "$next" "$release" || die "перезапуск не прошёл /api/health — трафик не переключён"
point_proxy "$next"
log "перезапуск: $release (слот $next, переменные окружения перечитаны)"
