import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '@german-job-engine/shared-types';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../auth/application/dto/jwt-payload.interface';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { APPLICATION_REPOSITORY, ApplicationRepository } from '../../../applications/domain/repositories/application.repository.interface';
import { FOLLOW_UP_CONTROL_REPOSITORY, FollowUpControlRepository } from '../../domain/ports/follow-up-control.repository';
import { FollowUpControlService } from '../../application/services/follow-up-control.service';
import { FollowUpResumeService } from '../../application/services/follow-up-resume.service';

class AdminActionReasonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

/**
 * M30 Phase 17 — secure admin visibility and operations for Recruitment Workflow Orchestration.
 * Matching `AdminInboxIntelligenceController`'s exact guard stack. Every mutating action requires
 * a reason and records the acting admin id; every action preserves historical truth (a compliance
 * hold is a NEW control row, same `createSuperseding()` path every other control creation uses —
 * never a raw in-place status flip).
 */
@ApiTags('admin-recruitment-operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/recruitment-operations')
export class AdminRecruitmentOperationsController {
  constructor(
    @Inject(FOLLOW_UP_CONTROL_REPOSITORY) private readonly controls: FollowUpControlRepository,
    @Inject(APPLICATION_REPOSITORY) private readonly applications: ApplicationRepository,
    private readonly followUpControlService: FollowUpControlService,
    private readonly resumeService: FollowUpResumeService,
    private readonly audit: EmailSecurityAuditService,
  ) {}

  @ApiOperation({ summary: 'Every currently active follow-up hold/suppression across all users' })
  @Get('follow-up-controls/active')
  async listActive(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.controls.listActive(limit ? Math.min(Number(limit), 200) : 50, offset ? Number(offset) : 0);
  }

  /** A real compliance/security hold an admin applies directly — distinct from a candidate-facing
   * one in that it is never releasable by the candidate themselves (Phase 16: "no user may
   * manually release a compliance or security suppression" — enforced by
   * `FollowUpControlService.release()`'s own `USER_RELEASABLE_TYPES` allowlist, which this
   * endpoint deliberately does not use).
   *
   * `userId` on the created control is the real owning candidate's id (`application.candidateId`)
   * — NOT the acting admin's id. A control's `userId` is what every ownership check
   * (`FollowUpControlService.release()`, `RecruitmentOperationsController`'s own lookups) and
   * every `listByUserId()` query key off; recording it as the admin's id would make the control
   * permanently invisible to the very candidate it applies to and would fail the candidate's own
   * "is this my control" check. The acting admin is instead recorded in the audit trail below. */
  @ApiOperation({ summary: 'Apply an admin compliance/security hold on an application — reason required, never releasable by the candidate' })
  @Post('applications/:applicationId/compliance-hold')
  async applyComplianceHold(@Param('applicationId') applicationId: string, @Body() dto: AdminActionReasonDto, @CurrentUser() admin: JwtPayload) {
    const application = await this.applications.findById(applicationId);
    if (!application) {
      throw new NotFoundException('Application not found.');
    }
    const created = await this.followUpControlService.recordControl({
      userId: application.candidateId,
      applicationId,
      campaignId: null,
      companyId: null,
      jobId: null,
      sourceInboxMessageId: null,
      sourceProviderMessageId: null,
      controlType: 'MANUAL_REVIEW_HOLD',
      reasonCode: 'ADMIN_COMPLIANCE_HOLD',
      explanation: `Admin compliance hold: ${dto.reason}`,
      classification: null,
      confidence: null,
      evidence: null,
      expiresAt: null,
      correlationId: null,
    });
    await this.audit.record({ eventType: 'FOLLOW_UP_CONTROL_CREATED', userId: admin.sub, applicationId, detail: `Admin ${admin.sub} applied a compliance hold: ${dto.reason}` });
    return created;
  }

  @ApiOperation({ summary: 'Release any active follow-up control (admin override) — reason required' })
  @Post('follow-up-controls/:id/release')
  async releaseControl(@Param('id') id: string, @Body() dto: AdminActionReasonDto, @CurrentUser() admin: JwtPayload) {
    return this.followUpControlService.releaseAsAdmin(id, admin.sub, `Admin override: ${dto.reason}`);
  }

  @ApiOperation({ summary: 'Run the follow-up-hold expiry/resume job immediately — admin-triggered, same logic the scheduled job uses' })
  @Post('follow-up-controls/process-expired-now')
  async processExpiredNow() {
    return this.resumeService.processExpiredHolds(500);
  }
}
