# Bosqich 1: statik fayllarni yig'ish (bog'liqlik yo'q, testlar ham shu yerda).
FROM node:22-alpine AS build
WORKDIR /app
ARG DOMAIN
COPY . .
RUN node --test build.test.mjs && DOMAIN="$DOMAIN" node build.mjs

# Bosqich 2: faqat tayyor fayllar + kichik Caddy server.
FROM caddy:2.10-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
ENV XDG_DATA_HOME=/tmp/caddy XDG_CONFIG_HOME=/tmp/caddy
USER nobody
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
