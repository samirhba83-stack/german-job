# syntax=docker/dockerfile:1
#
# M31 Phase 4 — production hardening pass (same reasoning as apps/api/Dockerfile). Uses Next's
# `output: 'standalone'` (next.config.js) so the runtime image needs only the traced dependency
# closure `.next/standalone` actually produces, not the whole monorepo or a full `node_modules`.

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml* package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @german-job-engine/shared-types build
RUN pnpm --filter @german-job-engine/web build

FROM base AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3000

# `.next/standalone` already contains a minimal, traced `node_modules` (production deps only) and
# a self-contained `server.js` — no separate production `pnpm install` stage is needed here, unlike
# the API image, since Next's own build step already did that tracing.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone /repo/apps/web
COPY --from=build --chown=node:node /repo/apps/web/.next/static /repo/apps/web/apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public /repo/apps/web/apps/web/public

USER node
WORKDIR /repo/apps/web/apps/web
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/', (r) => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
