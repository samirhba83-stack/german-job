import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../shared/infrastructure/database/prisma.module';
import { EnvironmentModule } from '../../shared/infrastructure/environment/environment.module';
import { HealthController } from './health.controller';
import { VersionController } from './version.controller';

/** M31 Phase 16/6/7 — explicitly imports `PrismaModule`/`ConfigModule` even though both are
 * `@Global()` and would resolve either way inside the real `AppModule` — self-containedness lesson
 * from M30 (docs/recruitment-operations/threat-model.md Finding #5): a module whose providers
 * inject a global service should still declare that dependency explicitly, so it never silently
 * breaks inside a narrower module graph (a partial test module, or any future reuse). */
@Module({
  imports: [PrismaModule, ConfigModule, EnvironmentModule],
  controllers: [HealthController, VersionController],
})
export class HealthModule {}
