export class CompanyAlreadyArchivedException extends Error {
  constructor(companyId: string) {
    super(`Company is already archived: ${companyId}`);
    this.name = 'CompanyAlreadyArchivedException';
  }
}
