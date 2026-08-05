import { Injectable, Logger } from '@nestjs/common';
import { EmailProviderGatewayService } from '../../../email-provider/application/services/email-provider-gateway.service';
import { EmailDeliveryRequest } from '../../../email-provider/domain/models/email-delivery-request';

export type BillingNotificationKind =
  | 'PAYMENT_SUCCEEDED'
  | 'PAYMENT_FAILED'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'SUBSCRIPTION_RENEWED'
  | 'SUBSCRIPTION_PAST_DUE'
  | 'GRACE_PERIOD_STARTED'
  | 'SUBSCRIPTION_CANCELED'
  | 'SUBSCRIPTION_EXPIRING'
  | 'REFUND_ISSUED'
  | 'DISPUTE_RECEIVED'
  | 'ENTITLEMENT_SUSPENDED'
  | 'ENTITLEMENT_RESTORED';

const SENDER = { displayName: 'German Job Engine Billing', emailAddress: 'billing@german-job-engine.internal' };

/**
 * M27 Phase 14 — reuses the exact same EmailProviderGatewayService the M26 execution pipeline
 * already uses for transactional sends, rather than building a second, parallel notification
 * system (explicitly ruled out: "Do not create an unrelated parallel notification system").
 * Routes through the same real Provider Selection / EMAIL_PROVIDER abstraction, currently bound
 * to NullEmailProvider — so, like every other email in this project today, these are real send
 * ATTEMPTS with a safe, honest no-op outcome until a real provider adapter exists. Never includes
 * payment amounts, card details, or any other sensitive payment data in the message body.
 */
@Injectable()
export class BillingNotificationService {
  private readonly logger = new Logger(BillingNotificationService.name);

  constructor(private readonly providerGateway: EmailProviderGatewayService) {}

  async notify(kind: BillingNotificationKind, recipientEmail: string, context: { planDisplayName?: string; graceDaysRemaining?: number }): Promise<void> {
    const { subject, body } = this.buildMessage(kind, context);
    const request: EmailDeliveryRequest = {
      requestId: `billing-notification-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sender: SENDER,
      recipientEmailAddress: recipientEmail,
      subject,
      plainTextBody: body,
      htmlBody: null,
      attachments: [],
    };

    try {
      const response = await this.providerGateway.send(request);
      if (!response.accepted) {
        this.logger.debug(`Billing notification "${kind}" not accepted by provider (expected while no real provider is configured): ${response.providerMessage}`);
      }
    } catch (error) {
      this.logger.warn(`Billing notification "${kind}" failed to send: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private buildMessage(kind: BillingNotificationKind, context: { planDisplayName?: string; graceDaysRemaining?: number }): { subject: string; body: string } {
    const plan = context.planDisplayName ?? 'your plan';
    switch (kind) {
      case 'PAYMENT_SUCCEEDED':
        return { subject: 'Payment received', body: `Your payment for ${plan} was successful.` };
      case 'PAYMENT_FAILED':
        return { subject: 'Payment failed', body: `We couldn't process your payment for ${plan}. Please update your payment method.` };
      case 'SUBSCRIPTION_ACTIVATED':
        return { subject: `Welcome to ${plan}`, body: `Your ${plan} subscription is now active.` };
      case 'SUBSCRIPTION_RENEWED':
        return { subject: 'Subscription renewed', body: `Your ${plan} subscription has renewed.` };
      case 'SUBSCRIPTION_PAST_DUE':
        return { subject: 'Payment issue with your subscription', body: `We couldn't renew ${plan}. Please update your payment method to avoid losing access.` };
      case 'GRACE_PERIOD_STARTED':
        return {
          subject: 'Action needed: update your payment method',
          body: `You have ${context.graceDaysRemaining ?? 7} day(s) to update your payment method before ${plan} access is paused.`,
        };
      case 'SUBSCRIPTION_CANCELED':
        return { subject: 'Subscription canceled', body: `Your ${plan} subscription has ended.` };
      case 'SUBSCRIPTION_EXPIRING':
        return { subject: 'Your subscription is ending soon', body: `Your ${plan} subscription will end at the close of your current billing period.` };
      case 'REFUND_ISSUED':
        return { subject: 'Refund issued', body: `A refund for ${plan} has been issued.` };
      case 'DISPUTE_RECEIVED':
        return { subject: 'Payment dispute received', body: `A payment dispute was received for ${plan}. Your access has been adjusted accordingly.` };
      case 'ENTITLEMENT_SUSPENDED':
        return { subject: 'Access paused', body: `Access to ${plan} features has been paused.` };
      case 'ENTITLEMENT_RESTORED':
        return { subject: 'Access restored', body: `Access to ${plan} features has been restored.` };
    }
  }
}
