#!/usr/bin/env bash
# Превью для pull request (docs/deploy.md): https://pr-<N>.<PREVIEW_DOMAIN>
#   preview.sh deploy <N> <архив .tgz>   — выложить / обновить
#   preview.sh remove <N>                — убрать (PR закрыт)
# Превью закрыто паролем и от поисковиков, заявки не уходят менеджерам (NOTIFY_TRANSPORT=mock),
# у каждого превью своя база. Настройки — /etc/uly-dala/deploy.env.
source "$(dirname "$0")/lib.sh"
# shellcheck disable=SC1091
[ -f /etc/uly-dala/deploy.env ] && source /etc/uly-dala/deploy.env
: "${PREVIEW_DOMAIN:?в /etc/uly-dala/deploy.env нет PREVIEW_DOMAIN}"
: "${PREVIEW_USER:?нет PREVIEW_USER}"
: "${PREVIEW_PASSWORD_HASH:?нет PREVIEW_PASSWORD_HASH (caddy hash-password)}"

action="${1:?deploy|remove}"; pr="${2:?номер PR}"
[[ "$pr" =~ ^[0-9]+$ ]] || die "номер PR — только цифры"
port=$((4000 + pr % 1000))
dir="$ULY_ROOT/previews/pr-$pr"
snippet="/etc/caddy/uly-dala/previews/pr-$pr.caddy"
db_dir=/var/lib/uly-dala/previews

if [ "$action" = "remove" ]; then
  sudo systemctl disable --now "uly-dala-preview@$pr" 2>/dev/null || true
  rm -rf "$dir" "$ULY_ROOT/previews/pr-$pr.env" "$db_dir/pr-$pr.sqlite"*
  rm -f "$snippet"; eval "$ULY_PROXY_RELOAD"
  log "превью pr-$pr удалено"; exit 0
fi

tarball="${3:?архив релиза}"
rm -rf "$dir"; mkdir -p "$dir" "$db_dir"
tar -xzf "$tarball" -C "$dir"; rm -f "$tarball"
release="$(tr -d '[:space:]' < "$dir/RELEASE")"
cat > "$ULY_ROOT/previews/pr-$pr.env" <<ENV
PORT=$port
HOSTNAME=127.0.0.1
LEADS_SQLITE_PATH=$db_dir/pr-$pr.sqlite
ENV
sudo systemctl enable "uly-dala-preview@$pr" >/dev/null 2>&1 || true
sudo systemctl restart "uly-dala-preview@$pr"
wait_healthy "$port" "$release" || die "превью pr-$pr не отвечает на /api/health"
cat > "$snippet" <<CADDY
pr-$pr.$PREVIEW_DOMAIN {
	import preview_common
	reverse_proxy 127.0.0.1:$port
}
CADDY
eval "$ULY_PROXY_RELOAD"
log "превью pr-$pr: $release → https://pr-$pr.$PREVIEW_DOMAIN"
