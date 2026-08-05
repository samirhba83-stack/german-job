export class ListApplicationsQuery {
  constructor(
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}
