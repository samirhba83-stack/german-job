import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExecutionModule } from '../execution/execution.module';
import { DocumentsModule } from '../documents/documents.module';
import { UsersModule } from '../users/users.module';
import { BETA_INVITATION_REPOSITORY } from './domain/ports/beta-invitation.repository';
import { PrismaBetaInvitationRepository } from './infrastructure/persistence/prisma-beta-invitation.repository';
import { BetaInvitationService } from './application/services/beta-invitation.service';
import { AdminBetaAccessController } from './presentation/controllers/admin-beta-access.controller';

/** M31 Phase 20 — Closed Beta Access Control. Depends on `execution` (`ExecutionClock`),
 * `documents` (the shared `EmailSecurityAuditService`), and `users` (`AdminBetaAccessController`'s
 * own real suspend/unsuspend operations need `USER_REPOSITORY`) — matches the established minimal-
 * dependency-footprint pattern (`RecruitmentOperationsModule`'s own doc comment is the most recent
 * precedent). `AuthModule` depends on THIS module (for `RegisterHandler`'s real gate), and also
 * imports `UsersModule` itself — no cycle, since `UsersModule` depends on neither. */
@Module({
  imports: [ExecutionModule, DocumentsModule, UsersModule, ConfigModule],
  controllers: [AdminBetaAccessController],
  providers: [{ provide: BETA_INVITATION_REPOSITORY, useClass: PrismaBetaInvitationRepository }, BetaInvitationService],
  exports: [BetaInvitationService],
})
export class BetaAccessModule {}
