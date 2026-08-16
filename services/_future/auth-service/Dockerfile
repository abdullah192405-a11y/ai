# ─── Stage 1: Build ───────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY services/auth-service/package*.json ./
RUN npm install --omit=dev
COPY services/auth-service/src/ ./src/
COPY services/auth-service/config/ ./config/
COPY packages/shared/ /shared/

# ─── Stage 2: Production ─────────────────────
FROM node:20-alpine AS production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/config ./config
COPY --from=builder /app/package.json ./
COPY --from=builder /shared /shared

ENV NODE_PATH=/app/node_modules
ENV NODE_ENV=production

USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "src/index.js"]
