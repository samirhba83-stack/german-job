import { EmploymentType, ContractType, RemotePolicy } from '@german-job-engine/shared-types';
import { OptionalJobFieldsInput } from '../../job-fields.builder';

export interface CreateJobLocation {
  city: string;
  country: string;
  postalCode?: string;
  street?: string;
}

export class CreateJobCommand {
  constructor(
    public readonly requesterId: string,
    public readonly data: OptionalJobFieldsInput & {
      title: string;
      description: string;
      employmentType: EmploymentType;
      contractType: ContractType;
      workLocation: CreateJobLocation;
      remotePolicy?: RemotePolicy;
    },
  ) {}
}
