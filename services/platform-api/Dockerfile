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

# ─── Install dependencies & packages ──────────────────────────────
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY services/platform-api/package.json ./services/platform-api/
COPY apps/user/package.json ./apps/user/
COPY apps/admin/package.json ./apps/admin/
COPY apps/website/package.json ./apps/website/
COPY apps/widget/package.json ./apps/widget/

RUN npm install --ignore-scripts

# ─── Copy remaining backend source & schemas ─────────────────────
COPY services/platform-api/ ./services/platform-api/
COPY database/ ./database/

# Create fallback directory for widget bundle if requested
RUN mkdir -p /app/apps/widget/dist && touch /app/apps/widget/dist/widget.iife.js

# ─── Runtime ──────────────────────────────────────────────────────
WORKDIR /app/services/platform-api

EXPOSE 8080

CMD ["node", "index.js"]
