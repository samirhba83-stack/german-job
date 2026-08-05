export const APPLICATION_ASSEMBLY_CONFIG = Symbol('APPLICATION_ASSEMBLY_CONFIG');

export interface ApplicationAssemblyConfig {
  /** Maximum number of certificates included as attachments; the rest are omitted, most-recent-first. */
  readonly maxCertificates: number;
}

export const DEFAULT_APPLICATION_ASSEMBLY_CONFIG: ApplicationAssemblyConfig = {
  maxCertificates: 3,
};
