import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EnvironmentValidationService } from './environment-validation.service';

/** M31 Phase 7 — explicitly imports `ConfigModule` even though it's `@Global()` (self-
 * containedness lesson from M30, docs/recruitment-operations/threat-model.md Finding #5). Exported
 * so both `main.ts` (via `app.get()`, for the real boot-time fail-closed check) and `HealthModule`
 * (for `/ready`'s cheap re-check) can reach it. */
@Module({
  imports: [ConfigModule],
  providers: [EnvironmentValidationService],
  exports: [EnvironmentValidationService],
})
export class EnvironmentModule {}
