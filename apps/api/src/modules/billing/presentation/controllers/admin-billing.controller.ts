import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RefundDto, UserRole } from '@german-job-engine/shared-types';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { JwtPayload } from '../../../auth/application/dto/jwt-payload.interface';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { RefundService } from '../../application/services/refund.service';
import { BillingResponseMapper } from '../../application/billing-response.mapper';
import { IssueRefundDto } from '../../application/dto/issue-refund.dto';

/**
 * M27 Phase 12 — admin-only billing operations. Every action requires ADMIN role (RolesGuard,
 * same guard every other admin-restricted endpoint in this codebase uses) and a mandatory reason
 * — enforced by IssueRefundDto's own validation, not just a UI convention. The acting admin's id
 * is always taken from the verified JWT (@CurrentUser()), never from client-supplied input, so
 * the audit trail can never be spoofed.
 */
@ApiTags('billing-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('billing/admin')
export class AdminBillingController {
  constructor(private readonly refundService: RefundService) {}

  @ApiOperation({ summary: 'Issue a policy-bound refund for a subscription — admin only, reason required, fully audited' })
  @ApiResponse({ status: 201, type: Object })
  @Post('subscriptions/:subscriptionId/refund')
  async issueRefund(
    @Param('subscriptionId') subscriptionId: string,
    @CurrentUser() admin: JwtPayload,
    @Body() dto: IssueRefundDto,
  ): Promise<RefundDto> {
    const refund = await this.refundService.issueRefund({ subscriptionId, reason: dto.reason, adminUserId: admin.sub });
    return BillingResponseMapper.toRefundDto(refund);
  }
}
