import { Body, Controller, Get, Inject, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole, type AdminConnectedMailboxDto } from '@german-job-engine/shared-types';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { JwtPayload } from '../../../auth/application/dto/jwt-payload.interface';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { ConnectedMailboxRepository, CONNECTED_MAILBOX_REPOSITORY } from '../../domain/ports/connected-mailbox.repository';
import { ConnectedMailboxRecord } from '../../domain/models/connected-mailbox';
import { MailboxConnectionService } from '../../application/services/mailbox-connection.service';
import { MailboxAdminActionDto } from '../../application/dto/mailbox-admin-action.dto';

/** Never exposes token fields or storage internals — same discipline as the user-facing
 * `MailboxConnectionsController`'s `toSafeResponse()`, just with the additional operational
 * fields Phase 19 asks admins to see (granted scopes, failure category, daily usage). Typed
 * against the real shared-types contract (`AdminConnectedMailboxDto`). */
function toAdminResponse(mailbox: ConnectedMailboxRecord): AdminConnectedMailboxDto {
  return {
    id: mailbox.id,
    userId: mailbox.userId,
    provider: mailbox.provider,
    emailAddress: mailbox.emailAddress,
    displayName: mailbox.displayName,
    isActive: mailbox.isActive,
    status: mailbox.status,
    grantedScopes: [...mailbox.grantedScopes],
    reauthorizationRequired: mailbox.reauthorizationRequired,
    userDisabled: mailbox.userDisabled,
    systemSuspended: mailbox.systemSuspended,
    suspensionReason: mailbox.suspensionReason,
    failureCategory: mailbox.failureCategory,
    failureReason: mailbox.failureReason,
    connectedAt: mailbox.connectedAt?.toISOString() ?? null,
    lastRefreshedAt: mailbox.lastRefreshedAt?.toISOString() ?? null,
    lastSuccessfulSendAt: mailbox.lastSuccessfulSendAt?.toISOString() ?? null,
    lastFailureAt: mailbox.lastFailureAt?.toISOString() ?? null,
    dailySendCount: mailbox.dailySendCount,
    rollingSendCount: mailbox.rollingSendCount,
    providerDailyLimit: mailbox.providerDailyLimit,
    consentVersion: mailbox.consentVersion,
    consentAcceptedAt: mailbox.consentAcceptedAt?.toISOString() ?? null,
    createdAt: mailbox.createdAt.toISOString(),
    updatedAt: mailbox.updatedAt.toISOString(),
  };
}

/**
 * M28.6 Phase 19 — the real operational visibility and control surface for connected mailboxes:
 * list every user's connection, and suspend/restore/force-reauthorization/disconnect a
 * compromised integration. Admin-only, matching `AdminEmailController`'s exact guard stack
 * (`JwtAuthGuard` + `RolesGuard` + `@Roles(ADMIN)`). Every mutating action requires a reason
 * (`MailboxAdminActionDto`) and is recorded via `EmailSecurityAuditService` with the acting
 * admin's id in `detail` — see `MailboxConnectionService`'s own doc comment on those methods.
 */
@ApiTags('admin-connected-mailbox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/connected-mailboxes')
export class AdminConnectedMailboxController {
  constructor(
    @Inject(CONNECTED_MAILBOX_REPOSITORY) private readonly mailboxes: ConnectedMailboxRepository,
    private readonly connectionService: MailboxConnectionService,
  ) {}

  @ApiOperation({ summary: 'Every connected mailbox across every user — provider, verified email, scopes, usage, failure/suspension state' })
  @Get()
  async list(@Query('limit') limit?: string, @Query('offset') offset?: string): Promise<AdminConnectedMailboxDto[]> {
    const rows = await this.mailboxes.listAll(limit ? Math.min(Number(limit), 200) : 50, offset ? Number(offset) : 0);
    return rows.map(toAdminResponse);
  }

  @ApiOperation({ summary: 'Pause a mailbox for safety review — reason required, logged with the acting admin id; sends are blocked immediately' })
  @Patch(':id/suspend')
  async suspend(@Param('id') id: string, @Body() dto: MailboxAdminActionDto, @CurrentUser() admin: JwtPayload): Promise<AdminConnectedMailboxDto> {
    return toAdminResponse(await this.connectionService.adminSuspend(id, admin.sub, dto.reason));
  }

  @ApiOperation({ summary: 'Lift a prior suspension — reason required; returns to CONNECTED, or REAUTHORIZATION_REQUIRED if no valid token remains on file' })
  @Patch(':id/restore')
  async restore(@Param('id') id: string, @Body() dto: MailboxAdminActionDto, @CurrentUser() admin: JwtPayload): Promise<AdminConnectedMailboxDto> {
    return toAdminResponse(await this.connectionService.adminRestore(id, admin.sub, dto.reason));
  }

  @ApiOperation({ summary: 'Force re-consent even though the current token may still work — reason required' })
  @Patch(':id/force-reauthorization')
  async forceReauthorization(@Param('id') id: string, @Body() dto: MailboxAdminActionDto, @CurrentUser() admin: JwtPayload): Promise<AdminConnectedMailboxDto> {
    return toAdminResponse(await this.connectionService.adminForceReauthorization(id, admin.sub, dto.reason));
  }

  @ApiOperation({ summary: 'Disconnect a compromised integration — best-effort provider revocation plus real local token destruction; reason required' })
  @Patch(':id/disconnect')
  async disconnect(@Param('id') id: string, @Body() dto: MailboxAdminActionDto, @CurrentUser() admin: JwtPayload): Promise<AdminConnectedMailboxDto> {
    return toAdminResponse(await this.connectionService.adminDisconnect(id, admin.sub, dto.reason));
  }
}
