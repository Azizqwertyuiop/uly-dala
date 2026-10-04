#!/usr/bin/env bash
# Подготовка сервера в РК (Ubuntu 24.04 LTS) — один раз, от root (docs/deploy.md, шаг 2).
#   scp -r deploy root@<IP>:/root/uly-dala-deploy
#   ssh root@<IP> 'bash /root/uly-dala-deploy/setup-server.sh "<публичный SSH-ключ для GitHub Actions>"'
# Повторный запуск безопасен: обновляет конфиги, данные не трогает.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "запускать от root"; exit 1; }
DEPLOY_KEY="${1:?первый аргумент — публичный SSH-ключ, с которым GitHub Actions будет выкладывать}"
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "== пакеты: Node.js 24, Caddy, SQLite, rsync, файрвол"
apt-get update -q
apt-get install -y -q ca-certificates curl gnupg debian-keyring debian-archive-keyring apt-transport-https \
  sqlite3 rsync ufw unattended-upgrades
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" != 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y -q nodejs
fi
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q && apt-get install -y -q caddy
fi

echo "== пользователь uly-dala (вход только по ключу GitHub Actions)"
id uly-dala >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash uly-dala
# Чтение журналов сайта (аналитика, ошибки — docs/runbook.md).
usermod -aG systemd-journal uly-dala
install -d -m 700 -o uly-dala -g uly-dala /home/uly-dala/.ssh
grep -qxF "$DEPLOY_KEY" /home/uly-dala/.ssh/authorized_keys 2>/dev/null ||
  echo "$DEPLOY_KEY" >> /home/uly-dala/.ssh/authorized_keys
chown uly-dala:uly-dala /home/uly-dala/.ssh/authorized_keys; chmod 600 /home/uly-dala/.ssh/authorized_keys

echo "== папки"
install -d -o uly-dala -g uly-dala /srv/uly-dala /srv/uly-dala/{bin,releases,slots,cdn,previews}
install -d -m 700 -o uly-dala -g uly-dala /var/lib/uly-dala /var/lib/uly-dala/previews /var/backups/uly-dala
install -d -m 750 -o root -g uly-dala /etc/uly-dala
install -d -o uly-dala -g caddy /etc/caddy/uly-dala /etc/caddy/uly-dala/previews
install -m 755 -o uly-dala -g uly-dala "$HERE"/bin/*.sh /srv/uly-dala/bin/
for f in production preview deploy; do
  [ -f "/etc/uly-dala/$f.env" ] || install -m 640 -o root -g uly-dala "$HERE/env/$f.env.example" "/etc/uly-dala/$f.env"
done
# До первой выкладки Caddy отвечает «скоро» (файл перезапишет deploy/bin/lib.sh).
[ -f /etc/caddy/uly-dala/upstream.caddy ] ||
  echo 'respond "Сайт выкладывается" 503' > /etc/caddy/uly-dala/upstream.caddy
chown uly-dala:caddy /etc/caddy/uly-dala/upstream.caddy

echo "== systemd и Caddy"
install -m 644 "$HERE"/systemd/* /etc/systemd/system/
install -m 644 "$HERE/caddy/Caddyfile" /etc/caddy/Caddyfile
install -d /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironmentFile=/etc/uly-dala/deploy.env\n' > /etc/systemd/system/caddy.service.d/uly-dala.conf
install -d -o caddy -g caddy /var/log/caddy
cat > /etc/sudoers.d/uly-dala <<'SUDO'
# Выкладка (deploy/bin/*.sh): только управление своими сервисами и перезагрузка Caddy.
uly-dala ALL=(root) NOPASSWD: /usr/bin/systemctl restart uly-dala@*, /usr/bin/systemctl stop uly-dala@*, \
  /usr/bin/systemctl enable uly-dala@*, \
  /usr/bin/systemctl restart uly-dala-preview@*, /usr/bin/systemctl enable uly-dala-preview@*, \
  /usr/bin/systemctl disable --now uly-dala-preview@*, /usr/bin/systemctl reload caddy
SUDO
chmod 440 /etc/sudoers.d/uly-dala; visudo -cf /etc/sudoers.d/uly-dala
systemctl daemon-reload
systemctl enable --now uly-dala-backup.timer
systemctl enable caddy

echo "== файрвол: только SSH, HTTP, HTTPS"
ufw allow OpenSSH; ufw allow 80/tcp; ufw allow 443/tcp; ufw --force enable

cat <<DONE

Готово. Дальше (docs/deploy.md):
  1. Заполнить /etc/uly-dala/deploy.env (домен) и /etc/uly-dala/production.env (токены).
  2. caddy hash-password → PREVIEW_PASSWORD_HASH в deploy.env.
  3. systemctl restart caddy
  4. Добавить секреты в GitHub и выложить (deploy.yml).
DONE
