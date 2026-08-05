'use client';

import { useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';
import { humanizeStatus } from '@/lib/status-mappings';
import { CampaignOutcomeGoal, CampaignStrategyType, Weekday } from '../types';
import type { CampaignPayload } from '../api/campaigns.api';
import { hasCampaignFormErrors, validateCampaignPayload, type CampaignFormErrors } from '../lib/validate-campaign-payload';

const DEFAULT_PAYLOAD: CampaignPayload = {
  name: '',
  goal: { targetApplicationCount: 20, desiredOutcome: CampaignOutcomeGoal.REPLIES, deadline: null },
  strategy: { type: CampaignStrategyType.BALANCED, parameters: {} },
  batchPlan: { baseBatchSize: 10, minBatchSize: 1, maxBatchSize: 20, adaptive: false, expansionIncrement: null },
  executionWindow: {
    allowedWeekdays: [Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY, Weekday.FRIDAY],
    dailyStartHour: 8,
    dailyEndHour: 18,
    timezone: 'Europe/Berlin',
    respectHolidays: true,
  },
  rateLimitProfile: { maxPerDay: 50, maxPerHour: 10, maxPerCompanyPerWindow: 1 },
};

const FIELDSET_CLASSES = 'flex flex-col gap-4 rounded-lg border border-border bg-surface p-4';
const LEGEND_CLASSES = 'text-heading-sm font-semibold text-primary';
const FIELD_LABEL_CLASSES = 'flex flex-col gap-1 text-caption font-semibold uppercase tracking-wide text-secondary';
const ERROR_CLASSES = 'text-body-sm text-status-critical';

export interface CampaignFormProps {
  initialValues?: CampaignPayload;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (payload: CampaignPayload) => void;
  onCancel?: () => void;
}

/**
 * The real Create/Edit form for `POST /campaigns` and `PATCH /campaigns/:id` — the flow M23
 * explicitly deferred to "its own focused milestone" (docs/campaign-workspace/
 * 08-future-extension-strategy.md). Every field maps 1:1 to a real, validated field on the
 * backend's `CreateCampaignDto`/`UpdateCampaignDto` (see `validate-campaign-payload.ts` for the
 * exact constraint mirror). `strategy.parameters` is intentionally not exposed — it's a real,
 * free-form `Record<string, string|number|boolean>` with no defined schema for any strategy type
 * today, so there is nothing honest to build a generic key-value editor for yet.
 */
export function CampaignForm({ initialValues, submitLabel, submitting, onSubmit, onCancel }: CampaignFormProps) {
  const [payload, setPayload] = useState<CampaignPayload>(initialValues ?? DEFAULT_PAYLOAD);
  const [errors, setErrors] = useState<CampaignFormErrors>({});
  const [touched, setTouched] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationErrors = validateCampaignPayload(payload);
    setErrors(validationErrors);
    setTouched(true);
    if (hasCampaignFormErrors(validationErrors)) return;
    onSubmit(payload);
  }

  function toggleWeekday(day: Weekday) {
    setPayload((prev) => {
      const allowedWeekdays = prev.executionWindow.allowedWeekdays.includes(day)
        ? prev.executionWindow.allowedWeekdays.filter((d) => d !== day)
        : [...prev.executionWindow.allowedWeekdays, day];
      return { ...prev, executionWindow: { ...prev.executionWindow, allowedWeekdays } };
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <fieldset className={FIELDSET_CLASSES}>
        <legend className={LEGEND_CLASSES}>Basics</legend>
        <Input
          label="Campaign name"
          value={payload.name}
          maxLength={150}
          required
          onChange={(event) => setPayload((prev) => ({ ...prev, name: event.target.value }))}
          error={touched ? errors.name : undefined}
        />
      </fieldset>

      <fieldset className={FIELDSET_CLASSES}>
        <legend className={LEGEND_CLASSES}>Goal</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Target application count"
            type="number"
            min={1}
            step={1}
            value={payload.goal.targetApplicationCount}
            onChange={(event) =>
              setPayload((prev) => ({
                ...prev,
                goal: { ...prev.goal, targetApplicationCount: Number(event.target.value) },
              }))
            }
            error={touched ? errors.targetApplicationCount : undefined}
          />
          <NativeSelect
            label="Desired outcome"
            value={payload.goal.desiredOutcome}
            onChange={(event) =>
              setPayload((prev) => ({
                ...prev,
                goal: { ...prev.goal, desiredOutcome: event.target.value as CampaignOutcomeGoal },
              }))
            }
          >
            {Object.values(CampaignOutcomeGoal).map((value) => (
              <option key={value} value={value}>
                {humanizeStatus(value)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </fieldset>

      <fieldset className={FIELDSET_CLASSES}>
        <legend className={LEGEND_CLASSES}>Strategy</legend>
        <NativeSelect
          label="Strategy type"
          value={payload.strategy.type}
          onChange={(event) =>
            setPayload((prev) => ({ ...prev, strategy: { ...prev.strategy, type: event.target.value as CampaignStrategyType } }))
          }
        >
          {Object.values(CampaignStrategyType).map((value) => (
            <option key={value} value={value}>
              {humanizeStatus(value)}
            </option>
          ))}
        </NativeSelect>
      </fieldset>

      <fieldset className={FIELDSET_CLASSES}>
        <legend className={LEGEND_CLASSES}>Batch plan</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Base batch size"
            type="number"
            min={1}
            step={1}
            value={payload.batchPlan.baseBatchSize}
            onChange={(event) =>
              setPayload((prev) => ({ ...prev, batchPlan: { ...prev.batchPlan, baseBatchSize: Number(event.target.value) } }))
            }
            error={touched ? errors.baseBatchSize : undefined}
          />
          <Input
            label="Minimum batch size"
            type="number"
            min={1}
            step={1}
            value={payload.batchPlan.minBatchSize}
            onChange={(event) =>
              setPayload((prev) => ({ ...prev, batchPlan: { ...prev.batchPlan, minBatchSize: Number(event.target.value) } }))
            }
            error={touched ? errors.minBatchSize : undefined}
          />
          <Input
            label="Maximum batch size"
            type="number"
            min={1}
            step={1}
            value={payload.batchPlan.maxBatchSize}
            onChange={(event) =>
              setPayload((prev) => ({ ...prev, batchPlan: { ...prev.batchPlan, maxBatchSize: Number(event.target.value) } }))
            }
            error={touched ? errors.maxBatchSize : undefined}
          />
        </div>
        <label className="flex items-center gap-2 text-body-sm text-primary">
          <input
            type="checkbox"
            checked={payload.batchPlan.adaptive ?? false}
            onChange={(event) => setPayload((prev) => ({ ...prev, batchPlan: { ...prev.batchPlan, adaptive: event.target.checked } }))}
            className="h-4 w-4 rounded border-border accent-accent"
          />
          Adaptive batch sizing
        </label>
      </fieldset>

      <fieldset className={FIELDSET_CLASSES}>
        <legend className={LEGEND_CLASSES}>Execution window</legend>
        <div>
          <span className={cn(FIELD_LABEL_CLASSES, 'mb-2 block')}>Allowed weekdays</span>
          <div className="flex flex-wrap gap-3">
            {Object.values(Weekday).map((day) => (
              <label key={day} className="flex items-center gap-1.5 text-body-sm text-primary">
                <input
                  type="checkbox"
                  checked={payload.executionWindow.allowedWeekdays.includes(day)}
                  onChange={() => toggleWeekday(day)}
                  className="h-4 w-4 rounded border-border accent-accent"
                />
                {humanizeStatus(day)}
              </label>
            ))}
          </div>
          {touched && errors.allowedWeekdays && <p className={ERROR_CLASSES}>{errors.allowedWeekdays}</p>}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Daily start hour"
            type="number"
            min={0}
            max={23}
            step={1}
            value={payload.executionWindow.dailyStartHour}
            onChange={(event) =>
              setPayload((prev) => ({ ...prev, executionWindow: { ...prev.executionWindow, dailyStartHour: Number(event.target.value) } }))
            }
            error={touched ? errors.dailyStartHour : undefined}
          />
          <Input
            label="Daily end hour"
            type="number"
            min={1}
            max={24}
            step={1}
            value={payload.executionWindow.dailyEndHour}
            onChange={(event) =>
              setPayload((prev) => ({ ...prev, executionWindow: { ...prev.executionWindow, dailyEndHour: Number(event.target.value) } }))
            }
            error={touched ? errors.dailyEndHour : undefined}
          />
          <Input
            label="Timezone"
            value={payload.executionWindow.timezone}
            onChange={(event) =>
              setPayload((prev) => ({ ...prev, executionWindow: { ...prev.executionWindow, timezone: event.target.value } }))
            }
            error={touched ? errors.timezone : undefined}
          />
        </div>
        <label className="flex items-center gap-2 text-body-sm text-primary">
          <input
            type="checkbox"
            checked={payload.executionWindow.respectHolidays ?? true}
            onChange={(event) =>
              setPayload((prev) => ({ ...prev, executionWindow: { ...prev.executionWindow, respectHolidays: event.target.checked } }))
            }
            className="h-4 w-4 rounded border-border accent-accent"
          />
          Respect German public holidays
        </label>
      </fieldset>

      <fieldset className={FIELDSET_CLASSES}>
        <legend className={LEGEND_CLASSES}>Rate limits</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Max per day"
            type="number"
            min={1}
            step={1}
            value={payload.rateLimitProfile?.maxPerDay ?? 1}
            onChange={(event) =>
              setPayload((prev) => ({
                ...prev,
                rateLimitProfile: { ...(prev.rateLimitProfile ?? DEFAULT_PAYLOAD.rateLimitProfile!), maxPerDay: Number(event.target.value) },
              }))
            }
            error={touched ? errors.maxPerDay : undefined}
          />
          <Input
            label="Max per hour"
            type="number"
            min={1}
            step={1}
            value={payload.rateLimitProfile?.maxPerHour ?? 1}
            onChange={(event) =>
              setPayload((prev) => ({
                ...prev,
                rateLimitProfile: { ...(prev.rateLimitProfile ?? DEFAULT_PAYLOAD.rateLimitProfile!), maxPerHour: Number(event.target.value) },
              }))
            }
            error={touched ? errors.maxPerHour : undefined}
          />
          <Input
            label="Max per company per window"
            type="number"
            min={1}
            step={1}
            value={payload.rateLimitProfile?.maxPerCompanyPerWindow ?? 1}
            onChange={(event) =>
              setPayload((prev) => ({
                ...prev,
                rateLimitProfile: {
                  ...(prev.rateLimitProfile ?? DEFAULT_PAYLOAD.rateLimitProfile!),
                  maxPerCompanyPerWindow: Number(event.target.value),
                },
              }))
            }
            error={touched ? errors.maxPerCompanyPerWindow : undefined}
          />
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export { DEFAULT_PAYLOAD as DEFAULT_CAMPAIGN_PAYLOAD };
