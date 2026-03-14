#!/bin/sh
# Select the right nginx config based on SSL_ENABLED env var (default: true)
SSL_ENABLED="${SSL_ENABLED:-true}"

if [ "$SSL_ENABLED" = "true" ]; then
    echo "[nginx] SSL mode: using nginx-ssl.conf"
    cp /etc/nginx/conf.d/nginx-ssl.conf /etc/nginx/nginx.conf
else
    echo "[nginx] HTTP mode: using nginx-http.conf"
    cp /etc/nginx/conf.d/nginx-http.conf /etc/nginx/nginx.conf
fi

exec nginx -g "daemon off;"
