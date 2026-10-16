# syntax=docker/dockerfile:1
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
# The 3D anatomy models are Git LFS files. The build context has no .git, so
# fetch the real models here (scripts/fetch-lfs-models.mjs: size + sha256
# checked, fails the build rather than ship a pointer). Own layer, so code
# changes don't re-download them. Private repo: --secret id=lfs_token,env=GH_TOKEN
COPY scripts/fetch-lfs-models.mjs scripts/
COPY public/models/ public/models/
RUN --mount=type=secret,id=lfs_token,required=false \
    node scripts/fetch-lfs-models.mjs public/models && mkdir -p /lfs-models && cp -a public/models/. /lfs-models/
COPY . .
# COPY . . brought the pointer files back; put the real models in place
RUN cp -a /lfs-models/. public/models/
ENV VITE_API_BASE_URL=/api/v1
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
