/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@german-job-engine/shared-types'],
  // M31 Phase 4 — Next's standalone output traces the actual runtime dependency closure into
  // `.next/standalone` (a minimal `node_modules`, no devDependencies, no other apps/packages in
  // the monorepo) — the production Dockerfile copies only this instead of the whole repo (Phase 1
  // audit finding: the previous image copied the entire monorepo into the runtime image).
  output: 'standalone',
};

module.exports = nextConfig;
