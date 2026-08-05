export class CompanyNotArchivedException extends Error {
  constructor(companyId: string) {
    super(`Company is not archived: ${companyId}`);
    this.name = 'CompanyNotArchivedException';
  }
}
