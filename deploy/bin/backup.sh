#!/usr/bin/env bash
# Резервная копия базы заявок (systemd: uly-dala-backup.timer, ежедневно).
# Копия делается средствами SQLite (.backup) — целостная даже во время записи.
# Хранится BACKUP_KEEP_DAYS дней. Копии содержат персональные данные: только на территории РК
# (раздел 14), доступ — только у пользователя uly-dala. TODO(legal): вторая площадка в РК.
set -euo pipefail
DB="${LEADS_SQLITE_PATH:-/var/lib/uly-dala/leads.sqlite}"
DIR="${BACKUP_DIR:-/var/backups/uly-dala}"
KEEP="${BACKUP_KEEP_DAYS:-30}"
umask 077
mkdir -p "$DIR"
out="$DIR/leads-$(date -u +%Y%m%d-%H%M%S).sqlite"
sqlite3 "$DB" ".backup '$out'"
sqlite3 "$out" "PRAGMA integrity_check;" | grep -qx ok || { echo "копия повреждена: $out" >&2; exit 1; }
gzip "$out"
find "$DIR" -name 'leads-*.sqlite.gz' -mtime +"$KEEP" -delete
echo "копия: $out.gz"
