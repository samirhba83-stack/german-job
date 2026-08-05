import { BadRequestException, Controller, Delete, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ConnectedMailboxDto, StartMailboxConnectionResponseDto } from '@german-job-engine/shared-types';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../auth/application/dto/jwt-payload.interface';
import { MailboxConnectionService } from '../../application/services/mailbox-connection.service';
import { ConnectedMailboxRepository, CONNECTED_MAILBOX_REPOSITORY } from '../../domain/ports/connected-mailbox.repository';
import { ConnectedMailboxRecord, ConnectedMailboxProvider } from '../../domain/models/connected-mailbox';

/** Exported so `inbox-intelligence`'s shared OAuth-callback controller (which must live outside
 * this module — see that controller's own doc comment for the module-direction reasoning) can
 * validate a provider slug identically, without a second, drifting copy of this map. */
export const PROVIDER_SLUGS: Record<string, ConnectedMailboxProvider> = { google: 'GOOGLE_GMAIL', microsoft: 'MICROSOFT_OUTLOOK' };

export function parseProviderSlug(slug: string): ConnectedMailboxProvider {
  const provider = PROVIDER_SLUGS[slug.toLowerCase()];
  if (!provider) {
    throw new BadRequestException(`Unknown mailbox provider "${slug}" — expected "google" or "microsoft".`);
  }
  return provider;
}

/** Never exposes token fields, storage internals, or anything beyond what a user needs to see
 * their own connection status (Phase 17: never expose access/refresh tokens, client secrets, or
 * internal encryption details). Typed against the real shared-types contract
 * (`ConnectedMailboxDto`) so a frontend/backend field drift fails at compile time, not at runtime. */
function toSafeResponse(mailbox: ConnectedMailboxRecord): ConnectedMailboxDto {
  return {
    id: mailbox.id,
    provider: mailbox.provider,
    emailAddress: mailbox.emailAddress,
    displayName: mailbox.displayName,
    isActive: mailbox.isActive,
    status: mailbox.status,
    reauthorizationRequired: mailbox.reauthorizationRequired,
    userDisabled: mailbox.userDisabled,
    systemSuspended: mailbox.systemSuspended,
    suspensionReason: mailbox.suspensionReason,
    connectedAt: mailbox.connectedAt?.toISOString() ?? null,
    lastRefreshedAt: mailbox.lastRefreshedAt?.toISOString() ?? null,
    lastSuccessfulSendAt: mailbox.lastSuccessfulSendAt?.toISOString() ?? null,
    lastFailureAt: mailbox.lastFailureAt?.toISOString() ?? null,
    failureReason: mailbox.failureReason,
    dailySendCount: mailbox.dailySendCount,
    createdAt: mailbox.createdAt.toISOString(),
    inboxCapabilityStatus: mailbox.inboxCapabilityStatus,
    inboxConsentAcceptedAt: mailbox.inboxConsentAcceptedAt?.toISOString() ?? null,
    inboxRevokedAt: mailbox.inboxRevokedAt?.toISOString() ?? null,
    lastSuccessfulInboxAccessAt: mailbox.lastSuccessfulInboxAccessAt?.toISOString() ?? null,
    inboxReauthorizationRequired: mailbox.inboxReauthorizationRequired,
    inboxFailureReason: mailbox.inboxFailureReason,
  };
}

/**
 * M28.6 Phase 7 — the real, user-facing connected-mailbox API. `emailAddress` in every response
 * comes from the provider's own verified identity — never anything a client could have supplied.
 *
 * M29 — the OAuth callback route (`GET callback/:provider`) moved OUT of this controller into
 * `inbox-intelligence`'s `MailboxOAuthCallbackController`: a single shared callback must be able
 * to dispatch to either `MailboxConnectionService` (send) or `InboxConsentService` (inbox
 * upgrade) depending on the transaction's own `capability`, and `connected-mailbox` cannot depend
 * on `inbox-intelligence` (the dependency runs the other way) — so the shared route lives in the
 * module that CAN see both services. This controller's own routes are unaffected; see that
 * controller's doc comment for the full reasoning.
 */
@ApiTags('mailbox-connections')
@Controller('mailbox-connections')
export class MailboxConnectionsController {
  constructor(
    private readonly connectionService: MailboxConnectionService,
    @Inject(CONNECTED_MAILBOX_REPOSITORY) private readonly mailboxes: ConnectedMailboxRepository,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':provider/start')
  async start(@Param('provider') providerSlug: string, @CurrentUser() user: JwtPayload): Promise<StartMailboxConnectionResponseDto> {
    const provider = parseProviderSlug(providerSlug);
    return this.connectionService.startConnection(user.sub, provider);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async listMine(@CurrentUser() user: JwtPayload): Promise<ConnectedMailboxDto[]> {
    const mailboxes = await this.mailboxes.listByUserId(user.sub);
    return mailboxes.map(toSafeResponse);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async disconnect(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<{ success: true }> {
    await this.connectionService.disconnect(user.sub, id);
    return { success: true };
  }
}
