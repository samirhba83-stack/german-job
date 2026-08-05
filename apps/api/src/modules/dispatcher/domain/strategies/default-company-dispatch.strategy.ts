import { CompanyDispatchProfile, CompanyDispatchStrategy } from '../ports/company-dispatch-strategy.port';

/** Neutral default: no company-specific profile is known, so no company-specific guidance is given. */
export class DefaultCompanyDispatchStrategy implements CompanyDispatchStrategy {
  resolve(companyId: string): CompanyDispatchProfile {
    return {
      companyId,
      preferredSendHourRange: null,
      explanation: 'No company-specific dispatch profile is configured; using campaign-level defaults.',
    };
  }
}
