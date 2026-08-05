import { User as PrismaUser } from '@german-job-engine/database';
import { UserRole } from '@german-job-engine/shared-types';
import { User } from '../../domain/entities/user.entity';
import { Email } from '../../domain/value-objects/email.vo';

/** Maps between the Prisma persistence model and the domain aggregate. */
export class UserMapper {
  static toDomain(raw: PrismaUser): User {
    return User.reconstitute(raw.id, {
      email: Email.create(raw.email),
      passwordHash: raw.password,
      // Prisma generates its own UserRole enum; values are identical to shared-types' by contract.
      role: raw.role as unknown as UserRole,
      createdAt: raw.createdAt,
    });
  }

  static toPersistence(user: User): Omit<PrismaUser, 'updatedAt'> {
    return {
      id: user.id,
      email: user.email.value,
      password: user.passwordHash,
      role: user.role as unknown as PrismaUser['role'],
      createdAt: user.createdAt,
    };
  }
}
