/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@german-job-engine/shared-types'],
  // M31 Phase 4 — Next's standalone output traces the actual runtime dependency closure into
  // `.next/standalone` (a minimal `node_modules`, no devDependencies, no other apps/packages in
  // the monorepo) — the production Dockerfile copies only this instead of the whole repo (Phase 1
  // audit finding: the previous image copied the entire monorepo into the runtime image).
  output: 'standalone',
  // M32 security remediation — real fix, not a suppression: Next's built-in `/_next/image`
  // optimization route is registered and live on every deployment regardless of whether this
  // app's own code ever renders a `next/image` component (confirmed here — zero usage anywhere in
  // this codebase) — verified live and reachable (a real HTTP request against a running container
  // reached the route handler) before this fix. It's powered by `sharp`, which carries a real,
  // currently-unpatched libvips-inherited advisory (GHSA-f88m-g3jw-g9cj) at the version `next`
  // itself pulls in. Since this app has no image-optimization use case at all, disabling it
  // entirely is a genuine, zero-behavior-change fix — not a version workaround — that closes the
  // real reachable route rather than just documenting around it.
  images: { unoptimized: true },
};

module.exports = nextConfig;
