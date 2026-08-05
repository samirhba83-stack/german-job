export class CompanyInCooldownException extends Error {
  constructor(companyId: string) {
    super(`Company ${companyId} is in a cooldown period`);
    this.name = 'CompanyInCooldownException';
  }
}
