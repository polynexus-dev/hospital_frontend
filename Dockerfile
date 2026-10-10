# Production frontend: Vite build (minified, no source maps; our code is
# obfuscated by default, third-party libraries in vendor-*.js are left as is
# because obfuscating them protects nothing and breaks some) served by nginx, which is also the deployment's reverse proxy
# (/api -> web:8000). TLS turns on when certificates are mounted at
# /etc/nginx/certs (see nginx/select-config.sh).
#
#   docker build -t hms-frontend:<version> .
#   docker build --build-arg OBFUSCATE=0 ...   (SaaS builds may skip obfuscation)

FROM node:20-alpine AS build
ARG OBFUSCATE=1
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV VITE_API_BASE_URL=/api/v1
# The 3D anatomy models are Git LFS files: without `git lfs pull` they're tiny
# pointer files, and the bundle would ship a broken model. Refuse to build.
RUN for f in public/models/*.glb public/models/*.gltf public/models/*.obj; do \
      if [ -f "$f" ] && head -c 100 "$f" | grep -q "git-lfs.github.com"; then \
        echo "$f is a Git LFS pointer, not the model. Run 'git lfs pull' in the Frontend repo, then build again." >&2; exit 1; \
      fi; \
    done
RUN rm -f .env .env.* \
    && npx tsc -b \
    && npx vite build --sourcemap false \
    && ls dist/assets/vendor-*.js >/dev/null \
    && if [ "$OBFUSCATE" = "1" ]; then \
         npx --yes javascript-obfuscator@4 dist/assets --output dist/assets --exclude "**/vendor-*.js" \
           --compact true --identifier-names-generator hexadecimal \
           --string-array true --string-array-encoding base64 --string-array-threshold 0.75 \
           --rename-globals false --self-defending false --control-flow-flattening false --source-map false; \
       fi \
    && ! find dist -name "*.map" | grep -q .

FROM nginx:1.27-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/http.conf nginx/https.conf nginx/app.inc /etc/nginx/hms/
COPY nginx/select-config.sh /docker-entrypoint.d/40-hms-select-config.sh
RUN chmod +x /docker-entrypoint.d/40-hms-select-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
