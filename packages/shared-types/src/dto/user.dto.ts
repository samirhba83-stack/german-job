import { UserRole } from '../enums';

export interface UserDto {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}
