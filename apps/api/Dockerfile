# syntax=docker/dockerfile:1

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

FROM base AS runner
# Prisma's own OpenSSL-version auto-detection (used at runtime to pick which already-generated
# engine binary to load) relies on the `openssl` package being present to identify the version;
# without it, detection silently fails and Prisma falls back to an OpenSSL 1.1 engine binary
# that does not exist on modern Alpine (OpenSSL 3.x only) — the `binaryTargets` entry in
# schema.prisma alone does not fix this, since it only controls what gets generated, not which
# one gets loaded. Scoped to this stage only, so it never invalidates the deps/install cache.
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
