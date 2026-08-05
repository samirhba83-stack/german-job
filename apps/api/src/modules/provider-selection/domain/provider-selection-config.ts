export const PROVIDER_SELECTION_CONFIG = Symbol('PROVIDER_SELECTION_CONFIG');

/** Business-tunable provider priority weights. Provided via DI (PROVIDER_SELECTION_CONFIG) so
 * which provider wins among several eligible candidates is configuration, never a hardcoded
 * comparison inside the selection algorithm. */
export interface ProviderSelectionConfig {
  /** providerId -> priority weight; higher wins among eligible candidates. */
  readonly providerPriority: Readonly<Record<string, number>>;
  /** Weight used for a provider not listed in providerPriority. */
  readonly defaultPriority: number;
}

export const DEFAULT_PROVIDER_SELECTION_CONFIG: ProviderSelectionConfig = {
  providerPriority: {},
  defaultPriority: 1,
};
