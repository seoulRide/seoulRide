#!/usr/bin/env bash
# Start the seoulRide production stack (web + nginx + certbot renew loop).
# First run on a fresh machine: run ./init-cert.sh once first, then this.
#
# Reads secrets from the repo's existing ../.env.local — no duplicate infra/.env.
set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE="../.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Create it (see /.env.example) before running."
  exit 1
fi

REBUILD=""
if [[ "${1:-}" == "--rebuild" ]]; then
  REBUILD="--build"
fi

echo "=== Bringing up seoulRide stack (env: $ENV_FILE) ==="
docker compose --env-file "$ENV_FILE" up -d $REBUILD

echo
echo "=== Container status ==="
docker compose --env-file "$ENV_FILE" ps

echo
echo "=== Smoke tests (host-internal) ==="
sleep 4
echo "-- http://localhost (expect 301)"
curl -sI -m 5 http://localhost | head -1 || echo "  request failed"
echo "-- https://localhost (expect 200, -k for self-checks)"
curl -ksI -m 5 https://localhost | head -1 || echo "  request failed"

echo
echo "Done. From an EXTERNAL network (mobile LTE), test:  https://seoulride.site"
