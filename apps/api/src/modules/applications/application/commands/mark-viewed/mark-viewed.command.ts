export class MarkViewedCommand {
  constructor(
    public readonly applicationId: string,
    public readonly evidenceType: string,
    public readonly evidenceExternalId: string,
    public readonly confidence: number,
    public readonly evidenceUrl?: string,
    public readonly correlationId?: string,
  ) {}
}
