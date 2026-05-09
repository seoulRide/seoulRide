#!/usr/bin/env bash
# One-time Let's Encrypt cert bootstrap for seoulride.site.
# Prereqs: external 80 must reach this host (router port-forward + ISP allowing
# inbound 80 + Windows portproxy if WSL2). DNS A seoulride.site → host public IP.
# Nothing else may be bound to port 80 while this runs.
set -euo pipefail
cd "$(dirname "$0")"

if [[ -f ../.env.local ]]; then
  set -a; source ../.env.local; set +a
fi

DOMAIN="seoulride.site"
EMAIL="${LETSENCRYPT_EMAIL:-dev.hibi@gmail.com}"
STAGING="${STAGING:-0}"

STAGING_FLAG=""
if [[ "$STAGING" == "1" ]]; then
  STAGING_FLAG="--staging"
  echo "*** STAGING mode — issuing test cert (browsers will not trust). Unset STAGING for real cert."
fi

echo "Issuing cert for $DOMAIN (email $EMAIL)..."

# Make sure no existing nginx is squatting on 80.
if docker ps --format '{{.Names}}' | grep -q '^seoulride-nginx$'; then
  echo "Stopping seoulride-nginx so port 80 is free for the standalone challenge..."
  docker stop seoulride-nginx
fi

docker run --rm \
  -v seoulride-certs:/etc/letsencrypt \
  -v seoulride-certbot-www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  $STAGING_FLAG \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN"

echo
echo "Cert issued. Files in 'seoulride-certs' Docker volume:"
docker run --rm -v seoulride-certs:/c alpine ls /c/live/"$DOMAIN"
echo
echo "Next: ./start-prod.sh"
