#!/bin/sh
# generate-ssl.sh — Creates a self-signed SSL certificate for local HTTPS
# Run this before starting the Docker stack for the first time.

SSL_DIR="$(dirname "$0")/../ssl"
mkdir -p "$SSL_DIR"

if [ -f "$SSL_DIR/server.crt" ]; then
  echo "[SSL] Certificate already exists at $SSL_DIR/server.crt"
  exit 0
fi

echo "[SSL] Generating self-signed certificate..."
openssl req -x509 -nodes -days 3650 \
  -newkey rsa:2048 \
  -keyout "$SSL_DIR/server.key" \
  -out "$SSL_DIR/server.crt" \
  -subj "/C=US/ST=Local/L=Local/O=PandaFree/CN=pandafree.local" \
  -addext "subjectAltName=IP:127.0.0.1,DNS:localhost,DNS:pandafree.local"

echo "[SSL] Certificate generated: $SSL_DIR/server.crt"
echo "[SSL] Note: Browsers will show a security warning for self-signed certs."
echo "[SSL] You can replace with a Let's Encrypt cert if exposing publicly."
