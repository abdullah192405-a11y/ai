# ─────────────────────────────────────────────────────────────────
# NABEEH Platform API — Production Dockerfile
# Base: Node 20 Alpine (small image, ~180MB)
# ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

# Install OS-level deps needed by Playwright chromium + pdf-parse
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    python3 \
    make \
    g++

# Tell Playwright to use the system Chromium (not download its own)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# ─── Install dependencies ─────────────────────────────────────────
# Copy only manifests first (better layer caching)
COPY package.json package-lock.json ./
COPY apps/user/package.json ./apps/user/
COPY apps/admin/package.json ./apps/admin/
COPY apps/website/package.json ./apps/website/
COPY apps/widget/package.json ./apps/widget/
COPY services/platform-api/package.json ./services/platform-api/
COPY packages/dashboard-ui/package.json ./packages/dashboard-ui/
COPY packages/plans/package.json ./packages/plans/
COPY packages/widget-config/package.json ./packages/widget-config/

RUN npm install --ignore-scripts

# ─── Copy source ──────────────────────────────────────────────────
COPY packages/ ./packages/
COPY services/platform-api/ ./services/platform-api/
COPY database/ ./database/

# ─── Runtime ──────────────────────────────────────────────────────
WORKDIR /app/services/platform-api

EXPOSE 8080

# Graceful startup: runs migrations then starts Express
CMD ["node", "index.js"]
