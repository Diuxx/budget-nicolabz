#!/usr/bin/env bash
set -euo pipefail

# Usage : bash deploy.sh [--release] [--nginx] [--ssl] [--domain=exemple.fr] [--email=moi@exemple.fr]
#   bash deploy.sh --domain=pecule.nicolabz.dev --email=moi@exemple.fr --ssl
# (DOMAIN et CERTBOT_EMAIL en variables d'environnement fonctionnent aussi)
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="pecule"
DOMAIN="${DOMAIN:-pecule.nicolabz.dev}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
SITE_ROOT="/var/www/$APP_NAME"
NGINX_AVAILABLE="/etc/nginx/sites-available/$APP_NAME"
NGINX_ENABLED="/etc/nginx/sites-enabled/$APP_NAME"

NEXT_LINK=""
CONFIGURE_NGINX=0
NEW_RELEASE=0
REQUEST_SSL=0

for arg in "$@"; do
  case "$arg" in
    --nginx) CONFIGURE_NGINX=1 ;;
    --release) NEW_RELEASE=1 ;;
    --ssl) REQUEST_SSL=1; CONFIGURE_NGINX=1 ;;
    --domain=*) DOMAIN="${arg#--domain=}" ;;
    --email=*) CERTBOT_EMAIL="${arg#--email=}" ;;
    *) echo "Option inconnue : $arg (usage : bash deploy.sh [--release] [--nginx] [--ssl] [--domain=exemple.fr] [--email=moi@exemple.fr])" >&2; exit 1 ;;
  esac
done

cd "$PROJECT_DIR"
command -v npm >/dev/null || { echo "npm est requis." >&2; exit 1; }
command -v rsync >/dev/null || { echo "rsync est requis." >&2; exit 1; }

# Le dossier du site appartient à l'utilisateur de déploiement : sudo n'est utilisé que s'il ne l'est pas.
site() {
  if [ -w "$SITE_ROOT" ]; then "$@"; else sudo "$@"; fi
}

cleanup() {
  [ -z "$NEXT_LINK" ] || site rm -f -- "$NEXT_LINK"
}
trap cleanup EXIT

if [ ! -d "$SITE_ROOT" ]; then
  echo "Création de $SITE_ROOT (sudo requis une seule fois)..."
  sudo install -d -m 755 -o "$(id -un)" -g "$(id -gn)" "$SITE_ROOT"
fi

echo "Installation des dépendances..."
npm ci --ignore-scripts

echo "Tests et build..."
npm test
npm run build
[ -f "$PROJECT_DIR/dist/index.html" ] || { echo "dist/index.html introuvable après le build." >&2; exit 1; }

RELEASE_DIR=""
CURRENT_DIR="$(site readlink -f -- "$SITE_ROOT/current" 2>/dev/null || true)"
if [ "$NEW_RELEASE" != "1" ] && [ -n "$CURRENT_DIR" ] && site test -d "$CURRENT_DIR"; then
  echo "Mise à jour de la release actuelle $CURRENT_DIR..."
  site rsync -r --delete --chmod=D755,F644 "$PROJECT_DIR/dist/" "$CURRENT_DIR/"
  RELEASE_DIR="$CURRENT_DIR"
else
  [ "$NEW_RELEASE" = "1" ] || echo "Aucune release actuelle : création d'une nouvelle release."
  RELEASE_DIR="$SITE_ROOT/releases/$(date -u +%Y%m%dT%H%M%SZ)-$$"
  NEXT_LINK="$SITE_ROOT/current.next.$$"
  echo "Préparation de la release $RELEASE_DIR..."
  site install -d -m 755 "$RELEASE_DIR"
  site rsync -r --chmod=D755,F644 "$PROJECT_DIR/dist/" "$RELEASE_DIR/"
fi

if [ "$CONFIGURE_NGINX" = "1" ]; then
  echo "Configuration Nginx pour $DOMAIN..."
  command -v nginx >/dev/null || { echo "nginx est requis." >&2; exit 1; }
  WRITE_NGINX=1
  if [ -e "$NGINX_AVAILABLE" ]; then
    if sudo grep -q "server_name $DOMAIN;" "$NGINX_AVAILABLE" && sudo grep -q "ssl_certificate" "$NGINX_AVAILABLE"; then
      # Réécrire le fichier supprimerait le bloc HTTPS ajouté par certbot.
      echo "Configuration Nginx déjà en HTTPS pour $DOMAIN : conservée."
      WRITE_NGINX=0
    else
      sudo cp -- "$NGINX_AVAILABLE" "$NGINX_AVAILABLE.bak.$(date -u +%Y%m%dT%H%M%SZ)"
      echo "Configuration existante sauvegardée (.bak)."
    fi
  fi
  # Certbot (--nginx) ajoutera ensuite le bloc 443 et la redirection HTTPS.
  if [ "$WRITE_NGINX" = "1" ]; then
  sudo tee "$NGINX_AVAILABLE" >/dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    root $SITE_ROOT/current;
    index index.html;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        try_files \$uri \$uri/ =404;
    }

    location ~* \.(?:css|js|svg|png|jpg|jpeg|webp|ico|woff2?)\$ {
        expires 7d;
        add_header Cache-Control "public";
        try_files \$uri =404;
    }
}
EOF
  sudo chmod 644 "$NGINX_AVAILABLE"
  fi
  if [ ! -e "$NGINX_ENABLED" ] && [ ! -L "$NGINX_ENABLED" ]; then
    sudo ln -s "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  elif [ "$(sudo readlink "$NGINX_ENABLED")" != "$NGINX_AVAILABLE" ]; then
    echo "Le site Nginx existe déjà et ne pointe pas vers $NGINX_AVAILABLE." >&2
    exit 1
  fi
  sudo nginx -t
fi

if [ -n "$NEXT_LINK" ]; then
  echo "Activation de la nouvelle release..."
  site ln -s "$RELEASE_DIR" "$NEXT_LINK"
  site mv -Tf "$NEXT_LINK" "$SITE_ROOT/current"
  NEXT_LINK=""
fi
[ "$CONFIGURE_NGINX" != "1" ] || sudo systemctl reload nginx

if [ "$REQUEST_SSL" = "1" ]; then
  command -v certbot >/dev/null || { echo "certbot est requis (sudo apt install certbot python3-certbot-nginx)." >&2; exit 1; }
  echo "Demande du certificat SSL pour $DOMAIN..."
  if [ -n "$CERTBOT_EMAIL" ]; then
    sudo certbot --nginx -d "$DOMAIN" --redirect --keep-until-expiring --non-interactive --agree-tos -m "$CERTBOT_EMAIL"
  else
    sudo certbot --nginx -d "$DOMAIN" --redirect --keep-until-expiring
  fi
fi

echo "Version déployée : $RELEASE_DIR"

# Premier déploiement : bash deploy.sh --domain=... --email=... --ssl
# (le DNS A de $DOMAIN doit déjà pointer vers le serveur, ports 80/443 ouverts)
# Mises à jour suivantes : bash deploy.sh
# Vérifications :
#   ls -l /var/www/pecule/
#   curl -I https://$DOMAIN/
#   sudo certbot renew --dry-run
