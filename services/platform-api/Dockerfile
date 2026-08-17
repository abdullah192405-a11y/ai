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

# ─── Build the embeddable widget bundle ──────────────────────────
# This is the only source of the served widget.iife.js — it is deliberately not
# committed, so the image can never serve a stale bundle. No `|| true` here: if
# the build breaks, the image build must fail loudly and visibly in Railway's
# build logs. A failed build does not cause downtime — Railway keeps the
# previous deployment serving.
#
# The trailing stamp records provenance; `curl .../widget.iife.js | tail -1`
# shows which build produced what is live.
COPY apps/widget/vite.config.js ./apps/widget/
COPY apps/widget/src/ ./apps/widget/src/
RUN npm run build -w @wba/widget \
    && cp apps/widget/dist/widget.iife.js services/platform-api/public/widget.iife.js \
    && printf '\n/* wba:build=docker %s */\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       >> services/platform-api/public/widget.iife.js \
    && test -s services/platform-api/public/widget.iife.js

# ─── Runtime ──────────────────────────────────────────────────────
WORKDIR /app/services/platform-api

EXPOSE 8080 80 3000

CMD ["node", "index.js"]
