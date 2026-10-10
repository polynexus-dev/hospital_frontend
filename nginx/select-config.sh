#!/bin/sh
# HTTPS when a certificate is mounted at /etc/nginx/certs/tls.crt + tls.key, plain HTTP otherwise.
set -e
if [ -s /etc/nginx/certs/tls.crt ] && [ -s /etc/nginx/certs/tls.key ]; then
  cp /etc/nginx/hms/https.conf /etc/nginx/conf.d/hms.conf
  echo "hms: TLS enabled"
else
  cp /etc/nginx/hms/http.conf /etc/nginx/conf.d/hms.conf
  echo "hms: no certificate in /etc/nginx/certs, serving HTTP"
fi
