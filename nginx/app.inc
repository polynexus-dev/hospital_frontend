server_tokens off;
root /usr/share/nginx/html;
client_max_body_size 36m;  # 25 MB of files once encrypted (PAYLOAD_MAX_BODY_BYTES)

gzip on;
gzip_types text/css application/javascript application/json image/svg+xml;

include /etc/nginx/hms/security-headers.inc;

location = /healthz { access_log off; return 200 "ok\n"; }

# Let's Encrypt domain checks (deploy/configure-domain).
location ^~ /.well-known/acme-challenge/ {
    root /var/www/acme;
    default_type text/plain;
}

location /api/ {
    proxy_pass http://web:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}

location /static/ {
    proxy_pass http://web:8000;
}

location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    include /etc/nginx/hms/security-headers.inc;  # a location's own add_header drops the server's
    try_files $uri =404;
}

location / {
    add_header Cache-Control "no-cache";
    include /etc/nginx/hms/security-headers.inc;
    try_files $uri /index.html;
}
