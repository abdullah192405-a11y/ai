FROM node:20-alpine AS builder
WORKDIR /app
COPY services/tenant-service/package*.json ./
RUN npm install --omit=dev
COPY services/tenant-service/src/ ./src/
COPY services/tenant-service/config/ ./config/
COPY services/auth-service/src/ ./auth-service/src/
COPY packages/shared/ /shared/
COPY packages/shared/ ./shared/

FROM node:20-alpine AS production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/config ./config
COPY --from=builder /app/package.json ./
COPY --from=builder /app/auth-service ./auth-service
COPY --from=builder /shared /shared
COPY --from=builder /app/shared ./shared
ENV NODE_PATH=/app/node_modules
ENV NODE_ENV=production
USER appuser
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3002/health || exit 1
CMD ["node", "src/index.js"]
