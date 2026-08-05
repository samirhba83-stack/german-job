import { UserRole, EmploymentType, ContractType, RemotePolicy } from '@german-job-engine/shared-types';
import { OptionalJobFieldsInput } from '../../job-fields.builder';
import { CreateJobLocation } from '../create-job/create-job.command';

export class UpdateJobCommand {
  constructor(
    public readonly jobId: string,
    public readonly requesterId: string,
    public readonly requesterRole: UserRole,
    public readonly changes: OptionalJobFieldsInput & {
      title?: string;
      description?: string;
      employmentType?: EmploymentType;
      contractType?: ContractType;
      workLocation?: CreateJobLocation;
      remotePolicy?: RemotePolicy;
    },
  ) {}
}
