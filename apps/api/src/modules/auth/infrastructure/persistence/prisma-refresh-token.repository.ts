import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface';

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async store(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.refreshToken.upsert({
      where: { userId },
      create: { userId, tokenHash, expiresAt },
      update: { tokenHash, expiresAt },
    });
  }

  async isValid(userId: string, tokenHash: string): Promise<boolean> {
    const record = await this.prisma.refreshToken.findUnique({ where: { userId } });

    if (!record) {
      return false;
    }

    return record.tokenHash === tokenHash && record.expiresAt.getTime() > Date.now();
  }

  async revoke(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
