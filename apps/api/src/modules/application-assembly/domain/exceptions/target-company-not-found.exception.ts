export class TargetCompanyNotFoundException extends Error {
  constructor(companyId: string) {
    super(`No target company found with id "${companyId}"`);
    this.name = 'TargetCompanyNotFoundException';
  }
}
