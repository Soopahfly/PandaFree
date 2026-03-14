# PandaFree 🐼

Self-hosted, fully local Bambu Labs 3D printer control dashboard. Runs in Docker. Works from any browser — desktop, phone, or tablet.

## Features
- 🖨 **Multi-printer dashboard** — real-time progress, temps, ETA, AMS
- 🎮 **Full control** — pause, resume, stop, speed, light, fan, temperatures
- 📷 **Live camera** — Bambu built-in camera + external RTSP cameras via WebRTC
- 🔒 **Secure auth** — JWT-based login, HTTPS by default
- 📱 **Mobile-responsive** — glassmorphic dark UI, works great on phones

## Prerequisites
- Docker + Docker Compose
- Bambu Labs printer with **LAN Only Mode** + **Developer Mode** enabled
  > Printer touchscreen → Settings → Network → LAN Only Mode → Developer Mode

## Quick Start

### Option A — Pre-built images (recommended)

No cloning or building required. Download the release compose file and go:

```bash
curl -O https://github.com/Soopahfly/PandaFree/releases/latest/download/docker-compose.release.yml
curl -O https://raw.githubusercontent.com/Soopahfly/PandaFree/main/.env.example
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET and change the admin password
```

Then follow steps 2–4 below (SSL cert generation and startup).

### Option B — Build from source

```bash
git clone https://github.com/Soopahfly/PandaFree.git
cd PandaFree
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET and change the admin password
```

Then follow steps 2–4 below. Start with `docker compose up -d` (uses `docker-compose.yml`).

---

### 2. Generate SSL certificate (first time only)
```bash
# On Linux/Mac:
bash scripts/generate-ssl.sh

# On Windows (PowerShell, using OpenSSL):
mkdir ssl
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 `
  -keyout ssl/server.key -out ssl/server.crt `
  -subj "/CN=pandafree.local" `
  -addext "subjectAltName=IP:127.0.0.1,DNS:localhost"
```

> Skip this step if `SSL_ENABLED=false` (reverse proxy mode).

### 3. Start the stack
```bash
# Pre-built images (Option A):
docker compose -f docker-compose.release.yml up -d

# Built from source (Option B):
docker compose up -d
```

### 4. Open the dashboard
Navigate to **https://localhost** (accept the self-signed SSL warning)

Default login: `admin` / `changeme` (set in `.env`)

## Adding a Printer
1. Go to **Settings** → **Add Printer**
2. Enter:
   - **IP Address** — shown on printer screen under Network
   - **Serial Number** — shown under Settings → Device
   - **Access Code** — shown under Settings → Network → LAN
3. The printer will connect automatically via MQTT over TLS

## Camera Setup
- **Bambu built-in camera**: Settings → click "📷 Camera" next to your printer
- **External RTSP camera**: Cameras tab → Add Camera → enter RTSP URL

## Updating

```bash
# Pull the latest images and restart
docker compose -f docker-compose.release.yml pull
docker compose -f docker-compose.release.yml up -d
```

Your data (`./data/`, `./ssl/`, `./go2rtc/`) is stored in local volumes and will not be affected by an update.

## Architecture
```
nginx (HTTPS :443)
  ├── /api/*  → Node.js backend :3000
  ├── /ws     → WebSocket (live printer state)
  └── /streams/ → go2rtc (WebRTC camera streams)
```

## Data Persistence
- `./data/pandafree.db` — SQLite database (users, printers, cameras)
- `./ssl/` — SSL certificates
- `./go2rtc/` — go2rtc config

## Environment Variables

Copy `.env.example` to `.env` and set the following:

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | *(required)* | Secret key used to sign login tokens. Use a long random string — e.g. `openssl rand -hex 32`. **Change this before exposing the dashboard to any network.** |
| `ADMIN_USERNAME` | `admin` | Username for the built-in admin account. |
| `ADMIN_PASSWORD` | `changeme` | Password for the built-in admin account. **Change this.** |
| `SSL_ENABLED` | `true` | `true` — nginx terminates TLS using the certs in `./ssl/` (recommended). `false` — nginx serves plain HTTP on port 80 only; use this when PandaFree sits behind an upstream reverse proxy (e.g. Traefik, Caddy, NGINX Proxy Manager) that already handles SSL. |

## Ports Used
| Port | Service |
|------|---------|
| 80   | HTTP (redirects to HTTPS, or dashboard when `SSL_ENABLED=false`) |
| 443  | HTTPS (dashboard, only when `SSL_ENABLED=true`) |
| 1984 | go2rtc WebRTC API |
| 8554 | RTSP server |
| 8555/udp | WebRTC SRTP |

## Troubleshooting

**Browser shows SSL warning on first load**
This is expected with a self-signed certificate. Click "Advanced" → "Proceed" (Chrome) or "Accept the Risk" (Firefox). You only need to do this once per browser.

**Printer shows as offline / won't connect**
- Confirm **LAN Only Mode** and **Developer Mode** are both enabled on the printer
- Verify the IP address, serial number, and access code are entered correctly
- Make sure the machine running Docker is on the same local network as the printer
- Check the backend logs: `docker compose logs backend`

**Camera feed not loading**
- Confirm the RTSP URL is reachable from the Docker host (test with VLC or `ffprobe`)
- Check go2rtc logs: `docker compose logs go2rtc`
- WebRTC requires ports 8554 (RTSP) and 8555/udp (SRTP) to be accessible

**Port conflict on startup**
- Ports 80, 443, 1984, 8554, or 8555 may already be in use. Stop the conflicting service or edit the port mappings in your compose file.

**Forgot admin password**
Delete `./data/pandafree.db` and restart the stack. The database will be recreated using the credentials in your `.env` file. **This will remove all printers and cameras.**

## License

MIT — see [LICENSE](LICENSE)
