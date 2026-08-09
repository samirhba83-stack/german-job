import { registerAs } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** M31 Phase 6 — Release Versioning. `gitCommit`/`buildTimestamp` are injected at BUILD time (CI
 * pipeline / Docker build), never computed at runtime (a running container has no `.git` directory
 * — the pre-M31 image didn't even copy one). `appVersion` is read directly from `package.json`,
 * which IS bundled into the image, so it needs no separate injection. Every value here is safe to
 * expose publicly (Phase 6: "لا تعرض معلومات حساسة... للعامة") — none of it reveals dependency
 * versions, internal topology, or secrets.
 *
 * M31.2 — `RENDER_GIT_COMMIT` is a real environment variable Render sets automatically on every
 * service, at both build and run time, populated from the exact commit that service deployed
 * (https://render.com/docs/environment-variables#all-runtimes — no account/dashboard action
 * needed to get this, it's automatic). Checked as a fallback so a real Render deployment reports
 * its real commit even if the render.yaml blueprint's own explicit `GIT_COMMIT` env var were ever
 * left unset — belt-and-suspenders, not a replacement for setting it explicitly (doc 36's own
 * blueprint does set it explicitly too). `BUILD_TIMESTAMP` has no Render-provided equivalent —
 * still requires an explicit build-time value (doc 36's blueprint sets one). */
function readAppVersion(): string {
  try {
    const raw = readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8');
    return (JSON.parse(raw) as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export default registerAs('release', () => ({
  appVersion: readAppVersion(),
  gitCommit: process.env.GIT_COMMIT ?? process.env.RENDER_GIT_COMMIT ?? 'unknown',
  buildTimestamp: process.env.BUILD_TIMESTAMP ?? 'unknown',
  deploymentActor: process.env.DEPLOYMENT_ACTOR ?? 'unknown',
}));
