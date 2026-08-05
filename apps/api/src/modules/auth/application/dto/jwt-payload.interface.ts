import { UserRole } from '@german-job-engine/shared-types';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}
