import { Body, Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  BillingLedgerEntryDto,
  BillingStatusDto,
  CheckoutSessionResponseDto,
  PlanCatalogueEntryDto,
  PlanCode,
} from '@german-job-engine/shared-types';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { JwtPayload } from '../../../auth/application/dto/jwt-payload.interface';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { SUBSCRIPTION_REPOSITORY, SubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';
import { BillingEntitlementProjectionService } from '../../application/services/billing-entitlement-projection.service';
import { CheckoutService } from '../../application/services/checkout.service';
import { CancellationService } from '../../application/services/cancellation.service';
import { PlanChangeService } from '../../application/services/plan-change.service';
import { PLAN_CATALOGUE, PAID_PLAN_CODES } from '../../domain/plan-catalogue';
import { BillingResponseMapper } from '../../application/billing-response.mapper';
import { CreateCheckoutSessionDto } from '../../application/dto/create-checkout-session.dto';
import { CancelSubscriptionDto } from '../../application/dto/cancel-subscription.dto';
import { ChangePlanDto } from '../../application/dto/change-plan.dto';
import { PrismaBillingLedgerRepository } from '../../infrastructure/persistence/prisma-billing-ledger.repository';

/**
 * M27 — real, user-facing billing endpoints. Every write goes through an application service
 * that re-derives server-side truth; nothing here accepts a trusted price, plan name, or
 * entitlement level from the client (Phase 4/15). Ownership is implicit and absolute: every
 * operation acts on @CurrentUser()'s own data — there is no id parameter a user could substitute
 * to reach another user's billing state (closing the exact gap the pre-M27 stub controller had:
 * GET /billing/subscriptions/:userId with no ownership check at all).
 *
 * JwtAuthGuard is applied per-method rather than at the class level — `GET /plans` is
 * deliberately public (a pricing page a prospective customer sees before signing up, standard
 * SaaS practice; it returns zero user-specific data, so there is no ownership concern), every
 * other endpoint requires authentication.
 */
@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptionRepository: SubscriptionRepository,
    private readonly entitlementProjection: BillingEntitlementProjectionService,
    private readonly checkoutService: CheckoutService,
    private readonly cancellationService: CancellationService,
    private readonly planChangeService: PlanChangeService,
    private readonly config: ConfigService,
    private readonly ledgerRepository: PrismaBillingLedgerRepository,
  ) {}

  @ApiOperation({ summary: 'List the public plan catalogue — real server-side prices, limits, and marketing copy, never hardcoded on the frontend' })
  @ApiResponse({ status: 200, type: [Object] })
  @Get('plans')
  listPlans(): PlanCatalogueEntryDto[] {
    const priceIds = this.config.get<Record<string, string>>('billing.priceIds', {});
    return [...PAID_PLAN_CODES.map((code) => PLAN_CATALOGUE[code]), PLAN_CATALOGUE[PlanCode.FREE]]
      .sort((a, b) => a.priceCents - b.priceCents)
      .map((plan) => BillingResponseMapper.toPlanCatalogueEntryDto(plan, priceIds[plan.code] ?? null));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'The current user’s real billing status: subscription, entitlements, usage, and a plain-language explanation' })
  @ApiResponse({ status: 200 })
  @Get('status')
  async getStatus(@CurrentUser() user: JwtPayload): Promise<BillingStatusDto> {
    const [subscription, summary] = await Promise.all([
      this.subscriptionRepository.findCurrentByUserId(user.sub),
      this.entitlementProjection.getEntitlementSummary(user.sub),
    ]);
    return BillingResponseMapper.toBillingStatusDto(subscription, summary);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start a secure, idempotent Paddle checkout for a paid plan' })
  @ApiResponse({ status: 201, type: Object })
  @Post('checkout')
  async startCheckout(@CurrentUser() user: JwtPayload, @Body() dto: CreateCheckoutSessionDto): Promise<CheckoutSessionResponseDto> {
    const result = await this.checkoutService.startCheckout(user.sub, dto.planCode, dto.idempotencyKey);
    return { checkoutUrl: result.checkoutUrl, expiresAt: result.expiresAt.toISOString() };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Schedule cancellation at the end of the current billing period (never immediate)' })
  @ApiResponse({ status: 201 })
  @Post('cancel')
  async cancel(@CurrentUser() user: JwtPayload, @Body() dto: CancelSubscriptionDto): Promise<{ success: true }> {
    await this.cancellationService.scheduleCancellation(user.sub, dto.reason ?? null);
    return { success: true };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Undo a scheduled end-of-period cancellation before it takes effect' })
  @ApiResponse({ status: 201 })
  @Post('resume')
  async resume(@CurrentUser() user: JwtPayload): Promise<{ success: true }> {
    await this.cancellationService.resumeBeforePeriodEnd(user.sub);
    return { success: true };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upgrade or downgrade to a different paid plan' })
  @ApiResponse({ status: 201 })
  @Post('change-plan')
  async changePlan(@CurrentUser() user: JwtPayload, @Body() dto: ChangePlanDto): Promise<{ success: true }> {
    await this.planChangeService.changePlan(user.sub, dto.planCode);
    return { success: true };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Real payment/subscription history for the current user' })
  @ApiResponse({ status: 200 })
  @Get('ledger')
  async getLedger(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string): Promise<BillingLedgerEntryDto[]> {
    const entries = await this.ledgerRepository.findByUserId(user.sub, limit ? Math.min(Number(limit), 100) : 50);
    return entries.map((entry) => BillingResponseMapper.toLedgerEntryDto(entry));
  }
}
