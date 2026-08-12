# syntax=docker/dockerfile:1
#
# M31 Phase 4 — production hardening pass. Real changes from the pre-M31 version (Phase 1 audit
# findings, all closed here): non-root runtime user, minimal runtime image (production-only
# dependencies + only the built artifact, not the whole monorepo), a real HEALTHCHECK, and explicit
# signal handling via `dumb-init` (Node does not reap zombie processes or forward signals correctly
# as PID 1 by default — `dumb-init` is the standard, minimal fix so SIGTERM actually reaches the
# Node process for `main.ts`'s `app.enableShutdownHooks()` to act on).

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
# Only the manifests needed to resolve @german-job-engine/api's dependency closure — copying
# just these (rather than the whole repo) means editing source/schema files never invalidates
# this layer, so `pnpm install` is never re-run for changes that don't touch a package.json.
COPY pnpm-workspace.yaml pnpm-lock.yaml* package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @german-job-engine/database exec prisma generate
RUN pnpm --filter @german-job-engine/database build
RUN pnpm --filter @german-job-engine/shared-types build
RUN pnpm --filter @german-job-engine/api build
# `pnpm prune --prod` removes devDependencies (jest/eslint/typescript/ts-node/prisma-cli/etc.) from
# the ALREADY-INSTALLED tree in place — unlike a fresh `pnpm install --prod`, this never needs to
# re-run `prisma generate` (which needs the `prisma` CLI, a devDependency, to run at all), since the
# already-generated client under `node_modules/.prisma` is left untouched by pruning.
RUN pnpm prune --prod

FROM base AS runner
# Prisma's own OpenSSL-version auto-detection (used at runtime to pick which already-generated
# engine binary to load) relies on the `openssl` package being present to identify the version;
# without it, detection silently fails and Prisma falls back to an OpenSSL 1.1 engine binary
# that does not exist on modern Alpine (OpenSSL 3.x only) — the `binaryTargets` entry in
# schema.prisma alone does not fix this, since it only controls what gets generated, not which
# one gets loaded. `dumb-init` gives the container a real PID 1 that correctly forwards SIGTERM
# and reaps zombie child processes — Node itself does neither by default.
RUN apk add --no-cache openssl dumb-init
# M31.2 — real Trivy container-scan finding: the frozen `node:20-alpine` base image's baked-in
# libssl3/libcrypto3 (CVE-2026-45447) lags behind Alpine's own package repo — confirmed via
# `apk update && apk info openssl` that a patched build (openssl-3.5.7-r0) is already published
# there. `apk upgrade` re-syncs every OS package already on this image to whatever the repo
# currently has, closing this without waiting on Docker Hub to rebuild the base image tag.
RUN apk upgrade --no-cache
# M31.2 — real Trivy container-scan finding, closed for free with zero behavior risk: `node:20-
# alpine`'s own bundled `npm` (never invoked here — this repo uses pnpm exclusively, enforced via
# `corepack enable`) ships its own vendored `sigstore` dependency, which is genuinely outdated
# (CVE-2026-48815). Confirmed via `docker run --entrypoint sh ... find / -iname sigstore` that the
# only copy in the image lives at npm's own `node_modules`, not anywhere in our own dependency
# tree (absent from pnpm-lock.yaml entirely) — removing the unused npm install is strictly safer
# and smaller, not a workaround.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
ENV NODE_ENV=production
# M31 Phase 6 — build-time-injected release identity, surfaced at runtime by GET /version
# (release.config.ts). CD (cd.yml) passes these as --build-arg from the real git commit/build
# time; a local `docker build` without them falls back to "unknown" (release.config.ts's own
# default), never a fabricated value.
ARG GIT_COMMIT=unknown
ARG BUILD_TIMESTAMP=unknown
ENV GIT_COMMIT=$GIT_COMMIT
ENV BUILD_TIMESTAMP=$BUILD_TIMESTAMP

# Real non-root runtime user — `node:20-alpine` ships a built-in `node` user (uid 1000) for
# exactly this purpose; the pre-M31 image ran as root by default (Phase 1 audit finding).
#
# pnpm's default (isolated) linker gives EVERY workspace package its own `node_modules` directory
# of symlinks into the shared `.pnpm` virtual store (root `node_modules/.pnpm`) — a direct
# dependency of `@german-job-engine/api` (e.g. `reflect-metadata`) resolves via
# `apps/api/node_modules/reflect-metadata`, NOT via the root `node_modules` alone. The root
# `node_modules` copy (containing `.pnpm` itself, the real physical package contents every symlink
# points at) is necessary but not sufficient — every workspace package's own `node_modules`
# symlink directory must be copied too, or `require()` resolution fails at the first direct
# dependency lookup (self-caught: `Error: Cannot find module 'reflect-metadata'` on first real
# container run, before this fix).
COPY --from=build --chown=node:node /repo/node_modules /repo/node_modules
COPY --from=build --chown=node:node /repo/apps/api/node_modules /repo/apps/api/node_modules
COPY --from=build --chown=node:node /repo/packages/database/node_modules /repo/packages/database/node_modules
COPY --from=build --chown=node:node /repo/packages/database/dist /repo/packages/database/dist
COPY --from=build --chown=node:node /repo/packages/database/package.json /repo/packages/database/package.json
COPY --from=build --chown=node:node /repo/packages/shared-types/dist /repo/packages/shared-types/dist
COPY --from=build --chown=node:node /repo/packages/shared-types/package.json /repo/packages/shared-types/package.json
COPY --from=build --chown=node:node /repo/apps/api/dist /repo/apps/api/dist
COPY --from=build --chown=node:node /repo/apps/api/package.json /repo/apps/api/package.json

USER node
WORKDIR /repo/apps/api
EXPOSE 4000

# /health (not /ready) is the right Docker-level check: "is the process itself functioning",
# never "is a downstream dependency like Postgres currently reachable" — that distinction is a
# real orchestrator's readiness-probe concern (Phase 16), not a reason for Docker/an orchestrator
# to kill-and-restart this specific container (restarting the API does not fix a Postgres outage).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:4000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
