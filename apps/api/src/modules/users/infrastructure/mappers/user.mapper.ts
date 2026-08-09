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
      // M31 Phase 20 — suspension state is deliberately NOT part of the `User` domain entity
      // (it's an administrative concern applied via `UserRepository.suspend()`/`unsuspend()`
      // directly, never through this entity's own create/save flow) — a freshly created/saved
      // entity always maps to the neutral, not-suspended default here; `upsert`'s `update` branch
      // (below, in `PrismaUserRepository.save()`) never touches these fields either, so an
      // existing suspension is never accidentally cleared by an unrelated profile save.
      accountSuspended: false,
      accountSuspendedReason: null,
      accountSuspendedAt: null,
      accountSuspendedBy: null,
    };
  }
}
