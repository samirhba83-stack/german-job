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
# M31.2 — same real OS-package-lag Trivy fix as apps/api/Dockerfile (CVE-2026-45447 — see that
# file's own comment for the real evidence this closes it).
RUN apk upgrade --no-cache
# M31.2 — same real, zero-risk Trivy fix as apps/api/Dockerfile: this image never invokes npm
# (Next's standalone server.js is started directly by `node`), so node:20-alpine's bundled npm
# (and its outdated vendored sigstore — CVE-2026-48815) is dead weight, safely removed.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
ENV NODE_ENV=production
ENV PORT=3000

# `.next/standalone` already contains a minimal, traced `node_modules` (production deps only) and
# a self-contained `server.js` — no separate production `pnpm install` stage is needed here, unlike
# the API image, since Next's own build step already did that tracing. `.next/standalone` mirrors
# monorepo-root-relative paths, so `.next/static` (never included in standalone output — Next's own
# documented behavior) lands at the nested apps/web/apps/web/.next/static, matching Next's own
# monorepo standalone guidance — not a path mistake.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone /repo/apps/web
COPY --from=build --chown=node:node /repo/apps/web/.next/static /repo/apps/web/apps/web/.next/static
# M31.2 — real CI failure, root-caused and fixed: `apps/web/public` exists locally only as an
# EMPTY directory (created by the original create-next-app scaffold, never populated — confirmed
# by grepping the entire app source for any reference to a public/static asset: none exist, no
# favicon, no images). Git cannot track empty directories, so this COPY succeeded on every local
# build (Docker's build context reads the real local filesystem) but failed on every real GitHub
# Actions run (`actions/checkout@v4` clones the git repository, which never had this directory at
# all — "failed to compute cache key: /repo/apps/web/public: not found"). This is Case B, not
# Case A or C: not "assets exist but weren't copied right," not "an intentionally-empty directory
# needs a placeholder" — genuinely unused. Removed rather than papered over with a fake placeholder
# file solely to satisfy Docker. If real public assets (favicon, robots.txt, images) are ever
# added under apps/web/public, restore this line:
#   COPY --from=build --chown=node:node /repo/apps/web/public /repo/apps/web/apps/web/public

USER node
WORKDIR /repo/apps/web/apps/web
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/', (r) => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
