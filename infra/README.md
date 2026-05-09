# seoulRide self-hosted production stack

Docker Compose stack for serving https://seoulride.site from your own machine.

```
internet → router (port-forward 80/443) → Windows host
        → (WSL2 portproxy, if not mirrored)
        → docker compose stack:
             nginx  ─ 80/443, TLS termination, ACME challenge
                ↓ reverse_proxy
             web    ─ Next.js, listens on 3000 (container-internal only)
             certbot ─ background renew loop (12h)
```

## One-time setup

### 1. DNS (가비아)

Already done — `seoulride.site` A record points to the home public IP.
Verify: `getent hosts seoulride.site`.

### 2. Router port-forward (관리 페이지: 보통 192.168.0.1)

| External | Internal |
|---|---|
| TCP 80 | Windows host LAN IP : 80 |
| TCP 443 | Windows host LAN IP : 443 |

### 3. Windows firewall (admin PowerShell)

```powershell
New-NetFirewallRule -DisplayName "seoulRide 80"  -Direction Inbound -LocalPort 80  -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "seoulRide 443" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
```

### 4. WSL2 → Windows portproxy (only if NOT using `networkingMode=mirrored`)

Check `~/.wslconfig` on Windows:
```
[wsl2]
networkingMode=mirrored
```

If mirrored, skip this step. Otherwise (admin PowerShell):
```powershell
$WslIp = (wsl hostname -I).Trim()
netsh interface portproxy add v4tov4 listenport=80  listenaddress=0.0.0.0 connectport=80  connectaddress=$WslIp
netsh interface portproxy add v4tov4 listenport=443 listenaddress=0.0.0.0 connectport=443 connectaddress=$WslIp
netsh interface portproxy show all
```

> WSL IP changes on every boot (unless mirrored). Re-run portproxy after each WSL restart, or switch to mirrored networking.

### 5. Verify external reachability before issuing the cert

From a phone on LTE (NOT home Wi-Fi) try `http://seoulride.site` — even a 404 means
the network path works. Connection refused means steps 2–4 aren't right.

If 8080 works but 80/443 don't, KT/SK is blocking inbound 80/443 on this line and
self-hosting won't work without ISP intervention or a tunnel (Cloudflare).

### 6. Configure secrets

The stack reads from the **existing repo `.env.local`** at the repo root
(`/home/hidi/dev/seoulRide/.env.local`) — no separate `infra/.env` needed.
Keys consumed:

| Key | Used at | Purpose |
|---|---|---|
| `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` | build + runtime | NAVER Maps SDK (must be filled or maps 401) |
| `SEOUL_OPEN_API_KEY` | runtime | server-only, Seoul OpenAPI |
| `KMA_API_KEY` | runtime | server-only, weather |
| `SOLAR_API_KEY` | runtime | server-only, trending pipeline |
| `LETSENCRYPT_EMAIL` | init-cert only | optional (defaults to `dev.hibi@gmail.com`) |

If `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` was empty at build time, the bundled
client JS has no key → SDK 401 → page crashes on load. Re-run `start-prod.sh
--rebuild` after changing it.

### 7. Issue the Let's Encrypt cert (one-time)

```bash
cd infra
./init-cert.sh         # real cert
# or test first:
STAGING=1 ./init-cert.sh
```

This temporarily binds port 80 with certbot's standalone mode. Requires Step 5
to be working — Let's Encrypt will hit `http://seoulride.site/.well-known/acme-challenge/...`.

## Daily operation

```bash
cd infra

./start-prod.sh             # bring stack up, reuse images
./start-prod.sh --rebuild   # rebuild web/nginx after source changes
docker compose ps           # status
docker compose logs -f web  # tail logs
docker compose down         # stop
```

Cert auto-renew runs every 12h inside the certbot container. To force renewal:
```bash
docker compose exec certbot certbot renew --webroot -w /var/www/certbot
docker compose exec nginx nginx -s reload
```

## Verification

```bash
# host-internal
curl -I  http://localhost     # 301 → https
curl -kI https://localhost    # 200

# external (run from phone LTE)
curl -I  https://seoulride.site
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `init-cert.sh` fails with `unauthorized` | LE can't reach :80 from internet | Verify steps 2–5; test `http://<public-ip>` from LTE |
| `nginx` container exits with `cannot load certificate` | cert not in `seoulride-certs` volume | Run `init-cert.sh` first |
| `web` build fails on `pnpm install` | `apps/web/pnpm-lock.yaml` out of sync | `cd apps/web && pnpm install`, commit lockfile, rebuild |
| External timeout, internal `curl localhost` works | Router / firewall / portproxy missing | Steps 2–4 |
| WSL IP changed → can't reach docker | Re-run step 4 portproxy with new WSL IP | Or set mirrored networking |
| Cert renewed but browser still sees old cert | nginx didn't reload | `docker compose exec nginx nginx -s reload` |

## Files

```
infra/
├── docker-compose.yml          # service graph
├── .env.example                # template — copy to .env
├── init-cert.sh                # one-time Let's Encrypt bootstrap
├── start-prod.sh               # daily kickoff
├── nginx/
│   ├── Dockerfile              # nginx image build
│   ├── nginx.conf              # main
│   └── conf.d/seoulride.conf   # server blocks (80 redirect + 443 reverse_proxy)
└── web/
    └── Dockerfile              # Next.js multi-stage build
```
