#!/usr/bin/env bash
# Выкладка релиза в production (docs/deploy.md). Запускает GitHub Actions (deploy.yml) по SSH:
#   /srv/uly-dala/bin/release.sh /tmp/uly-dala-<id>.tgz
# 1. Распаковать релиз в releases/<id>.
# 2. Слить его cdn/ в общее хранилище статики (старые файлы остаются — открытые страницы не ломаются).
# 3. Запустить в свободном слоте, дождаться /api/health, переключить Caddy. Не прошёл — трафик не трогаем.
# 4. Удалить старые релизы (кроме последних 5 и работающих).
source "$(dirname "$0")/lib.sh"

tarball="${1:?использование: release.sh <архив релиза .tgz>}"
[ -f "$tarball" ] || die "нет файла $tarball"
mkdir -p "$ULY_ROOT/releases" "$ULY_ROOT/slots" "$ULY_ROOT/cdn"

tmp="$(mktemp -d "$ULY_ROOT/releases/.incoming.XXXXXX")"
tar -xzf "$tarball" -C "$tmp"
release="$(tr -d '[:space:]' < "$tmp/RELEASE")"
[ -n "$release" ] || die "в архиве нет RELEASE"
if [ -d "$ULY_ROOT/releases/$release" ]; then
  rm -rf "$tmp"; log "релиз $release уже распакован — повторная активация"
else
  mv "$tmp" "$ULY_ROOT/releases/$release"
fi

rsync -a --ignore-existing "$ULY_ROOT/releases/$release/cdn/" "$ULY_ROOT/cdn/"
log "выкладка: $release"
activate "$release"
prune_releases
rm -f "$tarball"
