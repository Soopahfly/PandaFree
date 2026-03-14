FROM nginx:alpine

# Copy both config variants and the entrypoint selector
COPY nginx/nginx-http.conf /etc/nginx/conf.d/nginx-http.conf
COPY nginx/nginx-ssl.conf  /etc/nginx/conf.d/nginx-ssl.conf
COPY nginx/docker-entrypoint.sh /docker-entrypoint-custom.sh
COPY frontend /usr/share/nginx/html

RUN chmod +x /docker-entrypoint-custom.sh

ENTRYPOINT ["/docker-entrypoint-custom.sh"]
