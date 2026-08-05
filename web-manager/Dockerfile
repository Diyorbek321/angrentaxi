FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* are inlined at build time — Railway passes service vars as build args.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Replaces the server.js the standalone build generates. Ours boots the same Next
# server but also hooks the HTTP `upgrade` event, which is how the socket.io
# handshake is proxied with the httpOnly session cookie instead of a token handed
# to page scripts. File tracing does not know about these files, hence the copy.
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/server ./server
EXPOSE 3002
CMD ["node", "server.js"]
