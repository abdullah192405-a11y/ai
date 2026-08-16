# WBA MVP backend (`services/platform-api`)

A single lean Express service that powers the embeddable chatbot end-to-end:

- serves the **widget loader** (`/embed.js`) and the prebuilt **widget bundle** (`/widget.iife.js`)
- returns the **live, tenant-controlled config** for an API key (`GET /v1/widget/config`)
- answers chat messages with **Google Gemini**, streamed as SSE (`POST /v1/assistant/query`)
- exposes the **dashboard API** (login, config, API keys) so subscribers control everything

```
Your site ──<script src=".../embed.js" data-key=...>──► embed.js
   embed.js ──GET /v1/widget/config──► platform-api ──► injects widget.iife.js
   widget   ──POST /v1/assistant/query (SSE)──► platform-api ──► Gemini
   dashboard ──login + /v1/me/config + /v1/me/keys──► platform-api ──► Postgres
```

## Repo layout (relevant paths)

| Path | Role |
|------|------|
| `apps/admin/` | Platform owner panel (you) |
| `apps/user/` | Subscriber / tenant app |
| `apps/website/` | Public marketing site |
| `apps/widget/` | Embeddable chat widget (build → served by platform-api) |
| `services/platform-api/` | This MVP API |
| `services/_future/` | Future microservice scaffolds (Docker profile `services`) |
| `infrastructure/docker/` | Docker Compose definitions |

## Prerequisites

- Node.js 20+
- Postgres (repo root `docker compose up -d postgres` loads `database/schemas/init.sql`)
- A Google Gemini API key: <https://aistudio.google.com/apikey>

## Setup

```bash
# 1. Start Postgres (from repo root)
docker compose up -d postgres

# 2. Configure + install
cd services/platform-api
cp .env.example .env
#   -> set GEMINI_API_KEY=... (and ADMIN_PASSWORD if you like)
npm install

# 3. Seed a tenant + user + website + API key
npm run seed

# 4. Run the API
npm run dev          # http://localhost:8080
```

Or from repo root: `npm run dev:api`

## Run the subscriber app (user)

```bash
cd apps/user
npm install
npm run dev          # http://localhost:5173
```

Or: `npm run dev:user` from repo root.

## Run the platform admin panel

```bash
cd apps/admin
npm install
npm run dev          # http://localhost:5174
```

Or: `npm run dev:admin` from repo root.

## Embed the widget on any site

```html
<script src="http://localhost:8080/embed.js" data-key="pk_live_xxxxxxxx" async></script>
```

Build the widget bundle first: `cd apps/widget && npm run build`

## API reference

### Public (widget) — auth via `X-API-Key`

| Method | Path                     | Purpose                                          |
| ------ | ------------------------ | ------------------------------------------------ |
| GET    | `/v1/widget/config`      | Public appearance/messages config (no secrets)   |
| POST   | `/v1/assistant/query`    | Chat; streams SSE `data: {"token":...}` + `[DONE]` |
| POST   | `/v1/assistant/feedback` | Store a thumbs up/down rating                    |

### Dashboard — auth via `Authorization: Bearer <JWT>`

| Method | Path                     | Purpose                                  |
| ------ | ------------------------ | ---------------------------------------- |
| POST   | `/v1/auth/login`         | Email/password login → JWT               |
| GET    | `/v1/me/config`          | Full config incl. systemPrompt/model     |
| PUT    | `/v1/me/config`          | Save config                              |
| GET    | `/v1/me/keys`            | List API keys                            |
| POST   | `/v1/me/keys`            | Create key (returns plaintext once)      |
| DELETE | `/v1/me/keys/:id`        | Revoke key                               |
| GET    | `/v1/me/conversations`   | Recent visitor sessions                  |

## Notes

- Config is stored per website in `websites.settings` (JSONB).
- API keys are stored as a sha-256 hash; the plaintext is only shown at creation.
- CORS is open so the widget can be embedded on any origin.
- Production microservices run via `docker compose --profile services up -d`.
