import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingProductionSafetyService } from './billing-production-safety.service';

function fakeConfig(values: Record<string, unknown>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('BillingProductionSafetyService.assertRealChargesAllowed', () => {
  it('never blocks sandbox, regardless of productionPaymentsEnabled', () => {
    const service = new BillingProductionSafetyService(fakeConfig({ 'billing.environment': 'sandbox', 'billing.productionPaymentsEnabled': false }));
    expect(() => service.assertRealChargesAllowed()).not.toThrow();
  });

  it('blocks production when productionPaymentsEnabled is false — fails closed', () => {
    const service = new BillingProductionSafetyService(fakeConfig({ 'billing.environment': 'production', 'billing.productionPaymentsEnabled': false }));
    expect(() => service.assertRealChargesAllowed()).toThrow(ServiceUnavailableException);
  });

  it('allows production once productionPaymentsEnabled is explicitly true', () => {
    const service = new BillingProductionSafetyService(fakeConfig({ 'billing.environment': 'production', 'billing.productionPaymentsEnabled': true }));
    expect(() => service.assertRealChargesAllowed()).not.toThrow();
  });
});
