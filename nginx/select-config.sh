#!/bin/sh
# HTTPS when a certificate is mounted at /etc/nginx/certs/tls.crt + tls.key,
# plain HTTP otherwise. A background check (every CERT_CHECK_SECONDS, default
# hourly) switches modes and reloads nginx when the certificate is added,
# replaced or renewed (Let's Encrypt), so no restart is needed.
set -e

cert_state() {
  if [ -s /etc/nginx/certs/tls.crt ] && [ -s /etc/nginx/certs/tls.key ]; then
    cat /etc/nginx/certs/tls.crt /etc/nginx/certs/tls.key | md5sum | cut -d' ' -f1
  else
    echo none
  fi
}

apply_config() {
  if [ "$1" = none ]; then
    cp /etc/nginx/hms/http.conf /etc/nginx/conf.d/hms.conf
    echo "hms: no certificate in /etc/nginx/certs, serving HTTP"
  else
    cp /etc/nginx/hms/https.conf /etc/nginx/conf.d/hms.conf
    echo "hms: TLS enabled"
  fi
}

state=$(cert_state)
apply_config "$state"

(
  while sleep "${CERT_CHECK_SECONDS:-3600}"; do
    now=$(cert_state)
    if [ "$now" != "$state" ]; then
      apply_config "$now"
      if nginx -t >/dev/null 2>&1; then
        nginx -s reload && echo "hms: certificate change picked up, nginx reloaded"
        state=$now
      else
        echo "hms: new certificate rejected by nginx -t; keeping the current one" >&2
        apply_config "$state"
      fi
    fi
  done
) &
