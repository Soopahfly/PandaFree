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

### 1. Copy and configure environment
```bash
cp .env.example .env
```

Edit `.env` with your values — see the [Environment Variables](#environment-variables) section below for a full description of each option.

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

### 3. Start the stack
```bash
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
