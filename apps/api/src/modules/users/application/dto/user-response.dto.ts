import { UserRole } from '@german-job-engine/shared-types';

export class UserResponseDto {
  id!: string;
  email!: string;
  role!: UserRole;
  createdAt!: Date;
}
