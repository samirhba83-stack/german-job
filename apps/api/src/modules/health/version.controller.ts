import { Controller, Get, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/infrastructure/database/prisma.service';

interface VersionResponse {
  readonly version: string;
  readonly gitCommit: string;
  readonly buildTimestamp: string;
  readonly environment: string;
  readonly migrationVersion: string;
}

/**
 * M31 Phase 6 — Release Versioning: a real, safe `/version` endpoint. Deliberately public and
 * deliberately minimal — every field here is safe to expose (Phase 6: "لا تعرض معلومات حساسة عن
 * البنية أو Dependencies للعامة"). Feature-flag state and deployment-actor identity are real parts
 * of a release manifest too, but are operationally sensitive (they reveal what capabilities are
 * currently live, real information for an attacker planning what to target) — those stay on the
 * existing admin-only surfaces (`AdminRecruitmentOperationsController` etc. already expose
 * effective flag-gated behavior indirectly; a future consolidated admin `/admin/release` endpoint
 * is a reasonable follow-up, not built this pass to avoid duplicating what admins can already infer
 * from existing admin routes).
 */
@Controller('version')
export class VersionController {
  private readonly logger = new Logger(VersionController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async version(): Promise<VersionResponse> {
    return {
      version: this.config.get<string>('release.appVersion', '0.0.0')!,
      gitCommit: this.config.get<string>('release.gitCommit', 'unknown')!,
      buildTimestamp: this.config.get<string>('release.buildTimestamp', 'unknown')!,
      environment: this.config.get<string>('app.environment', 'development')!,
      migrationVersion: await this.latestMigrationVersion(),
    };
  }

  /** The most recently applied Prisma migration's directory name (e.g.
   * `20260806090000_m30_recruitment_operations`) — a real, useful "what schema state is this
   * database actually in" signal for a release manifest, safe to expose (it's the same string
   * already visible to anyone with repo access, not a secret). `_prisma_migrations` is Prisma's own
   * bookkeeping table — not modeled in schema.prisma, so a raw query is the correct, only way to
   * read it. Fails soft (`'unknown'`) rather than ever making `/version` itself unavailable. */
  private async latestMigrationVersion(): Promise<string> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ migration_name: string }>>`
        SELECT migration_name FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL
        ORDER BY finished_at DESC
        LIMIT 1
      `;
      return rows[0]?.migration_name ?? 'unknown';
    } catch (error) {
      this.logger.warn(`Could not read migration version: ${error instanceof Error ? error.message : String(error)}`);
      return 'unknown';
    }
  }
}
