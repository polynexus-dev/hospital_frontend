#!/bin/sh
# Always HTTPS: the app's encryption needs a secure page, and browsers don't
# offer that over plain HTTP. Uses the certificate mounted at
# /etc/nginx/certs/tls.crt + tls.key, otherwise a self-signed one generated
# here for TLS_HOSTS (browsers warn until a real one is installed). A background
# check (every CERT_CHECK_SECONDS, default hourly) switches and reloads nginx
# when a certificate is added, replaced or renewed (Let's Encrypt), so no
# restart is needed.
set -e

SELF=/etc/nginx/selfsigned

cert_state() {
  if [ -s /etc/nginx/certs/tls.crt ] && [ -s /etc/nginx/certs/tls.key ]; then
    cat /etc/nginx/certs/tls.crt /etc/nginx/certs/tls.key | md5sum | cut -d' ' -f1
  else
    echo none
  fi
}

ensure_self_signed() {
  wanted="${TLS_HOSTS:-localhost}"
  if [ -s "$SELF/tls.crt" ] && [ "$(cat "$SELF/hosts" 2>/dev/null)" = "$wanted" ]; then
    return
  fi
  san="DNS:localhost,IP:127.0.0.1"
  for h in $(echo "$wanted" | tr ',' ' '); do
    case "$h" in
      localhost|127.0.0.1|*\**|*:*) ;;
      *[!0-9.]*) san="$san,DNS:${h#.}" ;;
      *) san="$san,IP:$h" ;;
    esac
  done
  mkdir -p "$SELF"
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=Hospital server" \
    -addext "subjectAltName=$san" -keyout "$SELF/tls.key" -out "$SELF/tls.crt" 2>/dev/null
  chmod 600 "$SELF/tls.key"
  echo "$wanted" > "$SELF/hosts"
  echo "hms: generated a self-signed certificate for $san"
}

apply_config() {
  # A non-standard HTTPS port has to appear in the redirect from port 80.
  port=""
  [ "${HTTPS_PUBLIC_PORT:-443}" = "443" ] || port=":$HTTPS_PUBLIC_PORT"
  if [ "$1" = none ]; then
    ensure_self_signed
    sed -e "s#/etc/nginx/certs/#$SELF/#g" -e "s#https://\$host#https://\$host$port#" /etc/nginx/hms/https.conf > /etc/nginx/conf.d/hms.conf
    echo "hms: no certificate in /etc/nginx/certs, using the self-signed one"
  else
    sed -e "s#https://\$host#https://\$host$port#" /etc/nginx/hms/https.conf > /etc/nginx/conf.d/hms.conf
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
