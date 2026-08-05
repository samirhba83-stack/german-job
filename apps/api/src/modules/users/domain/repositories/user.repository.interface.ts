import { Repository } from '../../../../shared/application';
import { User } from '../entities/user.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository extends Repository<User, string> {
  findByEmail(email: string): Promise<User | null>;
}
