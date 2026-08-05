/** DI token for the full set of registered EmailProviderPort instances the engine evaluates.
 * A future milestone that adds a real SMTP/Gmail/Microsoft Graph adapter appends it to this
 * registry's factory binding alone — nothing here or in ProviderSelectionEngineService changes. */
export const EMAIL_PROVIDERS = Symbol('EMAIL_PROVIDERS');
