import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../auth/application/dto/jwt-payload.interface';
import { OnboardingStatusService, OnboardingStatus } from '../../application/services/onboarding-status.service';

/** M31 Phase 21 — the real "what's complete/missing/why/what's next" surface for a Closed Beta
 * user, backing whatever onboarding UI the frontend builds. Every field is a live read of real
 * state (docs/production-certification/17-beta-onboarding.md) — never a fabricated progress bar. */
@ApiTags('onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly status: OnboardingStatusService) {}

  @ApiOperation({ summary: "The current user's real onboarding status across account/profile/mailbox/campaign" })
  @Get('status')
  async getStatus(@CurrentUser() user: JwtPayload): Promise<OnboardingStatus> {
    return this.status.getStatus(user.sub);
  }
}
