import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ConnectedMailboxModule } from '../connected-mailbox/connected-mailbox.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { OnboardingStatusService } from './application/services/onboarding-status.service';
import { OnboardingController } from './presentation/controllers/onboarding.controller';

/**
 * M31 Phase 21 — Beta Onboarding. Pure read-side aggregator, same shape as
 * `application-assembly.module.ts` (that module's own doc comment is the precedent): imports the
 * bounded contexts it reads real state from, owns no persistence of its own.
 */
@Module({
  imports: [UsersModule, ProfilesModule, ConnectedMailboxModule, CampaignsModule, ConfigModule],
  controllers: [OnboardingController],
  providers: [OnboardingStatusService],
})
export class OnboardingModule {}
