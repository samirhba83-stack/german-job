import { ApplicationAssemblyInput } from '../models/application-assembly-input';
import { ApplicationPackage } from '../models/application-package';

export const APPLICATION_ASSEMBLY_STRATEGY = Symbol('APPLICATION_ASSEMBLY_STRATEGY');

/** DI-replaceable business judgment: how CVs/certificates are selected and ordered into a package. */
export interface ApplicationAssemblyStrategy {
  assemble(input: ApplicationAssemblyInput, now: Date): ApplicationPackage;
}
