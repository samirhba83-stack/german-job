import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { Actor } from '../../../campaigns/domain/value-objects/actor.vo';
import { CorrelationId } from '../../../campaigns/domain/value-objects/correlation-id.vo';

export interface CampaignExecutionCallContext {
  readonly campaign: Campaign;
  readonly actor: Actor;
  readonly correlationId: CorrelationId;
  readonly now: Date;
}

/**
 * M26 closes a real, previously-documented gap (see the M26 architecture audit): no
 * correlation/call-context propagation mechanism existed anywhere in this codebase — every
 * pre-M26 service independently minted its own correlationId fallback. `WorkerService`
 * (M10, unmodified here — see WorkerModule) takes only `(pipeline, decision)`; it has no
 * parameter for the campaign/actor/correlationId its bound TaskExecutionPort needs to do real
 * per-target work. Rather than either (a) widening WorkerService's own tested contract or
 * (b) re-implementing its task-lifecycle orchestration in this module (both of which the
 * milestone's "reuse, don't duplicate" charter rules out), CampaignExecutionEntryPointService
 * runs each WorkerService.execute() call inside `withContext()`, and
 * CampaignExecutionTaskHandlerService reads the active context back out — a single, narrowly-
 * scoped call context, not a general request-scoped DI mechanism.
 */
@Injectable()
export class CampaignExecutionCallContextHolder {
  private readonly storage = new AsyncLocalStorage<CampaignExecutionCallContext>();

  async withContext<T>(context: CampaignExecutionCallContext, fn: () => Promise<T>): Promise<T> {
    return this.storage.run(context, fn);
  }

  current(): CampaignExecutionCallContext {
    const context = this.storage.getStore();
    if (!context) {
      throw new Error('CampaignExecutionTaskHandlerService.execute() was called outside a withContext() scope.');
    }
    return context;
  }
}
