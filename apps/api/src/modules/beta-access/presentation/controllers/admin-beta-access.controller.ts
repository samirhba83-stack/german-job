import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '@german-job-engine/shared-types';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../auth/application/dto/jwt-payload.interface';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { USER_REPOSITORY, UserRepository } from '../../../users/domain/repositories/user.repository.interface';
import { BetaInvitationService } from '../../application/services/beta-invitation.service';
import { BetaInvitationStatus } from '../../domain/models/beta-invitation';

class InviteDto {
  @IsEmail()
  email!: string;
}

class RevokeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

class SuspendDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

/** M31 Phase 20/27 — the real Closed Beta admin surface: invite/revoke invitations, view the beta
 * cohort, suspend/unsuspend a compromised or misbehaving account. Same guard stack as every other
 * admin controller in this codebase (`AdminInboxIntelligenceController` etc.). */
@ApiTags('admin-beta-access')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/beta-access')
export class AdminBetaAccessController {
  constructor(
    private readonly invitations: BetaInvitationService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly audit: EmailSecurityAuditService,
  ) {}

  @ApiOperation({ summary: 'Invite a real user to the Closed Beta — creates a real, email-bound, expiring invitation' })
  @Post('invitations')
  async invite(@Body() dto: InviteDto, @CurrentUser() admin: JwtPayload) {
    return this.invitations.invite(dto.email, admin.sub);
  }

  @ApiOperation({ summary: 'Every invitation — the real beta cohort view' })
  @Get('invitations')
  async listInvitations(@Query('status') status?: BetaInvitationStatus, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.invitations.list(status, limit ? Math.min(Number(limit), 200) : 50, offset ? Number(offset) : 0);
  }

  @ApiOperation({ summary: 'Revoke a pending invitation — reason required' })
  @Post('invitations/:id/revoke')
  async revoke(@Param('id') id: string, @Body() dto: RevokeDto, @CurrentUser() admin: JwtPayload) {
    return this.invitations.revoke(id, admin.sub, dto.reason);
  }

  @ApiOperation({ summary: 'Suspend a compromised or misbehaving account — reason required, takes effect immediately (real-time check on every authenticated request)' })
  @Post('users/:userId/suspend')
  async suspendUser(@Param('userId') userId: string, @Body() dto: SuspendDto, @CurrentUser() admin: JwtPayload) {
    const status = await this.users.getAccountStatus(userId);
    if (!status) {
      throw new NotFoundException('User not found.');
    }
    await this.users.suspend(userId, dto.reason, admin.sub, new Date());
    await this.audit.record({ eventType: 'ACCOUNT_SUSPENDED', userId: admin.sub, detail: `Suspended user ${userId}: ${dto.reason}` });
    return { userId, suspended: true };
  }

  @ApiOperation({ summary: 'Unsuspend a previously-suspended account' })
  @Post('users/:userId/unsuspend')
  async unsuspendUser(@Param('userId') userId: string, @CurrentUser() admin: JwtPayload) {
    const status = await this.users.getAccountStatus(userId);
    if (!status) {
      throw new NotFoundException('User not found.');
    }
    await this.users.unsuspend(userId);
    await this.audit.record({ eventType: 'ACCOUNT_UNSUSPENDED', userId: admin.sub, detail: `Unsuspended user ${userId}` });
    return { userId, suspended: false };
  }
}
