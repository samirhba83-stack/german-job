/**
 * Real, verified geographic data originating from a Company record only —
 * never estimated, never inferred from postal code or city name. country
 * and city are the only fields Company data has always had; federalState
 * (Bundesland) and latitude/longitude are new, genuinely optional fields
 * (see CompanyLocation) that stay null until a real company record
 * actually supplies them.
 */
export interface GeographicContext {
  readonly country: string;
  readonly federalState: string | null;
  readonly city: string;
  readonly postalCode: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}
