export class ListCompaniesQuery {
  constructor(
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}
