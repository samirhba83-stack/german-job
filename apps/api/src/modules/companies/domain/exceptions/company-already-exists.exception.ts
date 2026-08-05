export class CompanyAlreadyExistsException extends Error {
  constructor(ownerId: string) {
    super(`A company already exists for owner: ${ownerId}`);
    this.name = 'CompanyAlreadyExistsException';
  }
}
