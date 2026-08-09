import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { UserRepository, UserAccountStatus } from '../../domain/repositories/user.repository.interface';
import { User } from '../../domain/entities/user.entity';
import { UserMapper } from '../mappers/user.mapper';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAccountStatus(userId: string): Promise<UserAccountStatus | null> {
    const row = await this.prisma.user.findUnique({ where: { id: userId }, select: { accountSuspended: true, accountSuspendedReason: true } });
    if (!row) return null;
    return { suspended: row.accountSuspended, reason: row.accountSuspendedReason };
  }

  async suspend(userId: string, reason: string, suspendedByAdminId: string, now: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { accountSuspended: true, accountSuspendedReason: reason, accountSuspendedAt: now, accountSuspendedBy: suspendedByAdminId },
    });
  }

  async unsuspend(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { accountSuspended: false, accountSuspendedReason: null, accountSuspendedAt: null, accountSuspendedBy: null },
    });
  }

  async findById(id: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({ where: { id } });
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({ where: { email } });
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async save(entity: User): Promise<void> {
    const data = UserMapper.toPersistence(entity);

    await this.prisma.user.upsert({
      where: { id: entity.id },
      create: data,
      update: {
        email: data.email,
        password: data.password,
        role: data.role,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
