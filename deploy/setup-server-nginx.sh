#!/usr/bin/env bash
# Подготовка ОБЩЕГО сервера, где уже работает nginx и другие проекты (docs/deploy.md,
# «Вариант: общий сервер с nginx»). Отличия от setup-server.sh:
#   - без Caddy: сайт — отдельный файл в nginx, HTTPS — certbot (как у соседних сайтов);
#   - Node.js — своя копия в /opt/uly-dala/node, системный node соседей не трогается;
#   - файрвол и пакеты соседей не трогаются; превью для PR не настраиваются.
#   scp -r deploy <user>@<IP>:/tmp/uly-dala-deploy
#   ssh <user>@<IP> 'sudo bash /tmp/uly-dala-deploy/setup-server-nginx.sh <домен> "<публичный ключ GitHub Actions>"'
# Повторный запуск безопасен: обновляет конфиги, данные и сертификаты не трогает.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "запускать через sudo"; exit 1; }
DOMAIN="${1:?первый аргумент — домен, например ulydala.events}"
DEPLOY_KEY="${2:?второй аргумент — публичный SSH-ключ GitHub Actions}"
HERE="$(cd "$(dirname "$0")" && pwd)"
NODE_MAJOR="$(tr -dc '0-9' < "$HERE/../.nvmrc" 2>/dev/null || echo 24)"
NODE_DIR=/opt/uly-dala/node

echo "== пакеты: sqlite3 (резервные копии базы заявок)"
command -v sqlite3 >/dev/null || { apt-get update -q && apt-get install -y -q sqlite3; }

echo "== Node.js $NODE_MAJOR — своя копия в $NODE_DIR"
if [ "$("$NODE_DIR/bin/node" -p 'process.versions.node.split(".")[0]' 2>/dev/null)" != "$NODE_MAJOR" ]; then
  tmp="$(mktemp -d)"
  base="https://nodejs.org/dist/latest-v$NODE_MAJOR.x"
  file="$(curl -fsSL "$base/SHASUMS256.txt" | grep -o "node-v[0-9.]*-linux-x64.tar.xz" | head -1)"
  curl -fsSL "$base/$file" -o "$tmp/$file"
  curl -fsSL "$base/SHASUMS256.txt" | grep " $file\$" | (cd "$tmp" && sha256sum -c -)
  rm -rf "$NODE_DIR" && install -d "$NODE_DIR"
  tar -xJf "$tmp/$file" -C "$NODE_DIR" --strip-components=1
  rm -rf "$tmp"
fi
"$NODE_DIR/bin/node" -v

echo "== пользователь uly-dala (вход только по ключу GitHub Actions)"
id uly-dala >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash uly-dala
usermod -aG systemd-journal uly-dala
install -d -m 700 -o uly-dala -g uly-dala /home/uly-dala/.ssh
grep -qxF "$DEPLOY_KEY" /home/uly-dala/.ssh/authorized_keys 2>/dev/null ||
  echo "$DEPLOY_KEY" >> /home/uly-dala/.ssh/authorized_keys
chown uly-dala:uly-dala /home/uly-dala/.ssh/authorized_keys; chmod 600 /home/uly-dala/.ssh/authorized_keys

echo "== папки"
install -d -o uly-dala -g uly-dala /srv/uly-dala /srv/uly-dala/{bin,releases,slots,cdn}
install -d -m 700 -o uly-dala -g uly-dala /var/lib/uly-dala /var/backups/uly-dala
install -d -m 750 -o root -g uly-dala /etc/uly-dala
install -m 755 -o uly-dala -g uly-dala "$HERE"/bin/*.sh /srv/uly-dala/bin/
[ -f /etc/uly-dala/production.env ] ||
  install -m 640 -o root -g uly-dala "$HERE/env/production.env.example" /etc/uly-dala/production.env
# Соль для rate limit — случайная, только на сервере.
grep -q '^RATE_LIMIT_SALT=$' /etc/uly-dala/production.env &&
  sed -i "s/^RATE_LIMIT_SALT=$/RATE_LIMIT_SALT=$(openssl rand -hex 32)/" /etc/uly-dala/production.env
# nginx читает статику из /srv/uly-dala/cdn (www-data).
chmod 755 /srv/uly-dala /srv/uly-dala/cdn

cat > /etc/uly-dala/proxy.env <<'PROXY'
# Выкладка на общем сервере: прокси — nginx (deploy/bin/lib.sh).
ULY_PROXY_FILE=/etc/nginx/uly-dala/upstream.conf
ULY_PROXY_LINE='server 127.0.0.1:%s;'
ULY_PROXY_RELOAD='sudo /usr/bin/systemctl reload nginx'
PROXY
chmod 644 /etc/uly-dala/proxy.env

echo "== systemd"
install -m 644 "$HERE/systemd/uly-dala@.service" "$HERE"/systemd/uly-dala-backup.* /etc/systemd/system/
install -d /etc/systemd/system/uly-dala@.service.d
cat > /etc/systemd/system/uly-dala@.service.d/shared-server.conf <<UNIT
# Общий сервер: своя копия Node.js; память — с запасом для соседних проектов.
[Service]
ExecStart=
ExecStart=$NODE_DIR/bin/node server.js
MemoryMax=512M
UNIT
cat > /etc/sudoers.d/uly-dala <<'SUDO'
# Выкладка (deploy/bin/*.sh): только свои сервисы и перезагрузка nginx.
uly-dala ALL=(root) NOPASSWD: /usr/bin/systemctl restart uly-dala@*, /usr/bin/systemctl stop uly-dala@*, \
  /usr/bin/systemctl enable uly-dala@*, /usr/bin/systemctl reload nginx
SUDO
chmod 440 /etc/sudoers.d/uly-dala; visudo -cf /etc/sudoers.d/uly-dala
systemctl daemon-reload
systemctl enable --now uly-dala-backup.timer

echo "== nginx"
install -d -o uly-dala -g uly-dala /etc/nginx/uly-dala
# До первой выкладки upstream указывает на слот 3001 (nginx ответит 502, пока релиза нет).
[ -f /etc/nginx/uly-dala/upstream.conf ] ||
  install -m 644 -o uly-dala -g uly-dala /dev/stdin /etc/nginx/uly-dala/upstream.conf <<<'server 127.0.0.1:3001;'
install -m 644 "$HERE/nginx/types.conf" /etc/nginx/uly-dala/types.conf
install -m 644 "$HERE/nginx/uly-dala-http.conf" /etc/nginx/conf.d/uly-dala.conf
# Сайт пишется один раз: потом certbot дописывает в него HTTPS — не затирать.
if [ ! -f /etc/nginx/sites-available/uly-dala ]; then
  sed "s/__DOMAIN__/$DOMAIN/g" "$HERE/nginx/uly-dala-site.conf" > /etc/nginx/sites-available/uly-dala
fi
ln -sfn /etc/nginx/sites-available/uly-dala /etc/nginx/sites-enabled/uly-dala
nginx -t
systemctl reload nginx

cat <<DONE

Готово. Дальше (docs/deploy.md):
  1. DNS: A-записи $DOMAIN и www.$DOMAIN → IP этого сервера.
  2. HTTPS: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN
  3. Токены уведомлений — /etc/uly-dala/production.env, затем /srv/uly-dala/bin/restart.sh
  4. Секреты в GitHub и выкладка (deploy.yml).
DONE
