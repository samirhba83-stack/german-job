import { Body, Controller, Get, Inject, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../auth/application/dto/jwt-payload.interface';
import { FollowUpControlService } from '../../application/services/follow-up-control.service';
import { RecruitmentTaskService } from '../../application/services/recruitment-task.service';
import { FOLLOW_UP_CONTROL_REPOSITORY, FollowUpControlRepository } from '../../domain/ports/follow-up-control.repository';
import { FollowUpControlRecord, FollowUpControlStatus } from '../../domain/models/follow-up-control';
import { RecruitmentTaskRecord, RecruitmentTaskStatus } from '../../domain/models/recruitment-task';

class ReleaseControlDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}

class DismissTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class ConfirmDueDateDto {
  @IsISO8601()
  dueAt!: string;
}

/** Never exposes internal fields (idempotencyKey, version, actor bookkeeping) — only what a user
 * needs to see their own follow-up control status, matching `InboxIntelligenceController`'s
 * `toMessageResponse()` precedent. */
function toControlResponse(control: FollowUpControlRecord) {
  return {
    id: control.id,
    applicationId: control.applicationId,
    campaignId: control.campaignId,
    controlType: control.controlType,
    status: control.status,
    reasonCode: control.reasonCode,
    explanation: control.explanation,
    classification: control.classification,
    confidence: control.confidence,
    createdAt: control.createdAt.toISOString(),
    effectiveAt: control.effectiveAt.toISOString(),
    expiresAt: control.expiresAt?.toISOString() ?? null,
    releasedAt: control.releasedAt?.toISOString() ?? null,
    releasedBy: control.releasedBy,
    releaseReason: control.releaseReason,
  };
}

function toTaskResponse(task: RecruitmentTaskRecord) {
  return {
    id: task.id,
    applicationId: task.applicationId,
    companyId: task.companyId,
    jobId: task.jobId,
    taskType: task.taskType,
    title: task.title,
    explanation: task.explanation,
    priority: task.priority,
    dueAt: task.dueAt?.toISOString() ?? null,
    dueDateConfidence: task.dueDateConfidence,
    originalDateText: task.originalDateText,
    status: task.status,
    completedAt: task.completedAt?.toISOString() ?? null,
    dismissedAt: task.dismissedAt?.toISOString() ?? null,
    dismissReason: task.dismissReason,
    createdAt: task.createdAt.toISOString(),
  };
}

/**
 * M30 Phase 12 — the real, user-facing recruitment-operations API: viewing and releasing
 * follow-up controls, viewing/completing/dismissing recruitment tasks, confirming an ambiguous
 * extracted date. Every route requires the verified JWT; every write is scoped to the
 * authenticated user's own data (`FollowUpControlService.release()`/`RecruitmentTaskService`'s own
 * ownership checks) — never a raw id lookup another user could substitute their own id into.
 */
@ApiTags('recruitment-operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recruitment')
export class RecruitmentOperationsController {
  constructor(
    @Inject(FOLLOW_UP_CONTROL_REPOSITORY) private readonly controls: FollowUpControlRepository,
    private readonly followUpControlService: FollowUpControlService,
    private readonly taskService: RecruitmentTaskService,
  ) {}

  @Get('follow-up-controls')
  async listFollowUpControls(@CurrentUser() user: JwtPayload, @Query('status') status?: FollowUpControlStatus, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    const rows = await this.controls.listByUserId(user.sub, status, limit ? Math.min(Number(limit), 200) : 50, offset ? Number(offset) : 0);
    return rows.map(toControlResponse);
  }

  @Get('follow-up-controls/:id')
  async getFollowUpControl(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const control = await this.requireOwnedControl(id, user.sub);
    return toControlResponse(control);
  }

  @Post('follow-up-controls/:id/release')
  async releaseFollowUpControl(@Param('id') id: string, @Body() dto: ReleaseControlDto, @CurrentUser() user: JwtPayload) {
    await this.requireOwnedControl(id, user.sub);
    const released = await this.followUpControlService.release(id, user.sub, dto.reason);
    return toControlResponse(released);
  }

  @Get('tasks')
  async listTasks(@CurrentUser() user: JwtPayload, @Query('status') status?: RecruitmentTaskStatus, @Query('applicationId') applicationId?: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    const rows = await this.taskService.listForUser({ userId: user.sub, status, applicationId }, limit ? Math.min(Number(limit), 200) : 50, offset ? Number(offset) : 0);
    return rows.map(toTaskResponse);
  }

  @Post('tasks/:id/complete')
  async completeTask(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return toTaskResponse(await this.taskService.completeTask(id, user.sub));
  }

  @Post('tasks/:id/dismiss')
  async dismissTask(@Param('id') id: string, @Body() dto: DismissTaskDto, @CurrentUser() user: JwtPayload) {
    return toTaskResponse(await this.taskService.dismissTask(id, user.sub, dto.reason ?? null));
  }

  @Patch('tasks/:id/confirm-due-date')
  async confirmDueDate(@Param('id') id: string, @Body() dto: ConfirmDueDateDto, @CurrentUser() user: JwtPayload) {
    return toTaskResponse(await this.taskService.confirmDueDate(id, user.sub, new Date(dto.dueAt)));
  }

  private async requireOwnedControl(id: string, userId: string): Promise<FollowUpControlRecord> {
    const control = await this.controls.findById(id);
    if (!control || control.userId !== userId) {
      throw new NotFoundException('Follow-up control not found.');
    }
    return control;
  }
}
