import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/infrastructure/database/prisma.service';
import { EnvironmentValidationService } from '../../shared/infrastructure/environment/environment-validation.service';

/**
 * M31 Phase 16 — real health/readiness/liveness, replacing the M11-era static `/health` stub
 * (Phase 1 audit finding: it returned `{status:'ok'}` unconditionally with zero dependency checks,
 * and `/ready`/`/live` did not exist at all).
 *
 * Three distinct, deliberately different-cost endpoints:
 * - `/health`   — safe, cheap, human/dashboard-facing overall status. Never runs an expensive
 *                 operation; never exposes secrets or connection strings.
 * - `/ready`    — "can this process accept real work right now": a real, cheap DB round trip
 *                 (`SELECT 1`) plus the critical-config presence check
 *                 (`EnvironmentValidationService`, Phase 7). A load balancer/orchestrator should
 *                 stop routing traffic to an instance failing this.
 * - `/live`     — "has this process's event loop frozen": zero dependency checks, by design — a
 *                 process whose DB connection is down is still alive and should stay `/live` (so
 *                 an orchestrator doesn't kill-and-replace it, which wouldn't fix a DB outage
 *                 anyway) while correctly failing `/ready` (so traffic stops routing to it).
 *
 * `runTicks` (Phase 3/4) is reported in `/health` since it's real, non-sensitive, and materially
 * changes what "ready" should mean for THIS process (an API-only replica has nothing tick-related
 * to be ready for; a worker replica's readiness should additionally reflect scheduler registration
 * — reserved for a future pass once a real distributed-lock-backed scheduler exists, see
 * docs/production-certification/ Known Limitations).
 */
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly environmentValidation: EnvironmentValidationService,
  ) {}

  @Get('health')
  async health(): Promise<{ status: string; timestamp: string; environment: string; runTicks: boolean }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: this.config.get<string>('app.environment', 'development')!,
      runTicks: this.config.get<boolean>('app.runTicks', true)!,
    };
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  live(): { status: string } {
    // Deliberately no dependency checks — reaching this handler at all IS the proof the process
    // is alive. Never make this endpoint do real work (Phase 16's own explicit instruction).
    return { status: 'alive' };
  }

  @Get('ready')
  async ready(): Promise<{ status: string; checks: Record<string, 'ok' | 'failed'> }> {
    const checks: Record<string, 'ok' | 'failed'> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'failed';
    }

    // The SAME real rules `EnvironmentValidationService` (Phase 7) refuses to boot without —
    // re-checked here (cheap — reads already-validated in-memory config, no I/O) so a config
    // regression introduced after boot (e.g. a bad hot-reloaded secret in some future deployment
    // model) still fails readiness rather than only failing at first real use.
    checks.criticalConfig = this.environmentValidation.validate(this.config).length === 0 ? 'ok' : 'failed';

    const allOk = Object.values(checks).every((v) => v === 'ok');
    if (!allOk) {
      throw new ServiceUnavailableException({ status: 'not_ready', checks });
    }
    return { status: 'ready', checks };
  }
}
