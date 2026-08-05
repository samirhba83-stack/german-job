export class CompanyNotFoundException extends Error {
  constructor(companyId: string) {
    super(`Company not found: ${companyId}`);
    this.name = 'CompanyNotFoundException';
  }
}
