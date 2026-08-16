# AI Website Assistant Platform

> An AI-powered contextual website assistant SaaS platform (MVP monorepo).

## Architecture

- **Production vision:** [`/architecture`](./architecture/) — microservices design docs
- **Current MVP:** single Express API (`platform-api`) + four frontend apps
- **Future scaffolds:** [`services/_future/`](./services/_future/) — archived service stubs

## Project Structure

```
ai/
├── apps/                   # Frontend applications
│   ├── admin/              # Platform owner panel (:5174)
│   ├── user/               # Tenant dashboard (:5173)
│   ├── website/            # Marketing site (:5180)
│   └── widget/             # Embeddable chat bundle → served by API
├── services/
│   └── platform-api/       # MVP backend — Express (:8080)
├── packages/               # Shared libraries
│   ├── dashboard-ui/       # LoginForm, API client, embed snippets, base CSS
│   ├── plans/              # Plan limits, pricing catalog (single source of truth)
│   ├── widget-config/      # Widget appearance defaults
├── database/               # SQL schemas and seeds
├── infrastructure/         # Docker, Terraform, Kubernetes
├── api-specs/              # OpenAPI specifications
└── architecture/           # System design documentation
```

## Quick Start

### Prerequisites

- Node.js >= 20
- Docker & Docker Compose (PostgreSQL)

### Local Development

```bash
# Install workspace dependencies
npm install

# Start Postgres (+ optional Redis)
npm run docker:up

# Run database migrations
npm run db:migrate

# Start services (separate terminals)
npm run dev:api       # http://localhost:8080
npm run dev:user      # http://localhost:5173
npm run dev:admin     # http://localhost:5174
npm run dev:website   # http://localhost:5180
npm run dev:widget    # builds widget.iife.js (served by API)
```

### Embed on a site

```html
<script src="http://localhost:8080/embed.js" data-key="YOUR_API_KEY" async></script>
```

Create API keys from the user dashboard → API Keys, or run `npm run seed -w @wba/platform-api`.

## Shared Packages

| Package | Purpose |
|---------|---------|
| `@wba/plans` | Plan limits, marketing catalog, `GET /v1/plans` data |
| `@wba/dashboard-ui` | `createApiClient`, `LoginForm`, `embedIntegrations`, `base.css` |
| `@wba/widget-config` | Widget colors, positions, default config |

## License

Proprietary — All rights reserved.
