# German Job Engine

A SaaS platform for job search & matching in the German market.

> **Status**: architecture scaffold only. No business logic is implemented yet — this repo defines
> the structure that future feature work will fill in.

## Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS
- **Backend**: NestJS, TypeScript, CQRS (`@nestjs/cqrs`)
- **Database**: PostgreSQL via Prisma ORM
- **Monorepo**: Turborepo + pnpm workspaces
- **Infra**: Docker / Docker Compose

## Architecture

The backend (`apps/api`) follows **Clean Architecture** layered per **DDD bounded context**.
Each module under `apps/api/src/modules/*` contains:

| Layer            | Responsibility                                                              |
| ----------------- | ---------------------------------------------------------------------------- |
| `domain`          | Entities, value objects, repository interfaces, domain events. No framework deps. |
| `application`     | Use cases as CQRS commands/queries + handlers, application DTOs, ports.     |
| `infrastructure`  | Repository implementations (Prisma), mappers, external adapters.           |
| `presentation`    | Nest controllers, module-specific guards.                                  |

Bounded contexts scaffolded:

- **users** — accounts, roles
- **auth** — JWT login/register/refresh (self-hosted, Passport)
- **jobs** — job listings, sourcing
- **applications** — candidates, applications
- **billing** — subscriptions, plans, payment provider adapters

Cross-cutting code lives in:

- `apps/api/src/shared` — DDD shared kernel (`Entity`, `AggregateRoot`, `ValueObject`, `Result`) + Prisma/logger infra
- `apps/api/src/common` — framework-level concerns (filters, interceptors, decorators, guards)

The frontend (`apps/web`) mirrors the same bounded contexts using a **feature-sliced** structure
under `src/features/*`, with thin route composition in `src/app/*`.

## Monorepo layout

```
apps/
  api/       NestJS backend
  web/       Next.js frontend
packages/
  database/      Prisma schema + generated client (@german-job-engine/database)
  shared-types/  DTOs/enums shared between web & api (@german-job-engine/shared-types)
  config/        Shared ESLint/TSConfig bases (@german-job-engine/config)
```

## Getting started

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres
pnpm db:generate
pnpm build
pnpm dev
```

- API: http://localhost:4000 (health check at `/health`)
- Web: http://localhost:3000

## Scripts

| Command             | Description                                  |
| -------------------- | --------------------------------------------- |
| `pnpm dev`           | Run all apps in dev mode (Turborepo)          |
| `pnpm build`         | Build all apps/packages                       |
| `pnpm lint`          | Lint all apps/packages                        |
| `pnpm test`          | Unit tests                                    |
| `pnpm test:e2e`      | End-to-end tests                              |
| `pnpm db:generate`   | Generate Prisma client                        |
| `pnpm db:migrate`    | Run Prisma dev migrations                     |
| `pnpm db:studio`     | Open Prisma Studio                            |

## Docker

```bash
docker compose up --build
```

Spins up `postgres`, `api`, and `web` per `docker-compose.yml`. Use `docker-compose.prod.yml` as
an override for production-oriented settings (`docker compose -f docker-compose.yml -f docker-compose.prod.yml up`).
