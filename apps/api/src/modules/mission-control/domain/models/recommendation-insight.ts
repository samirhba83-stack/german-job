export interface RecommendationInsight {
  readonly campaignId: string | null;
  readonly timestamp: Date;
  readonly recommendationCount: number;
  readonly explanation: string;
}
