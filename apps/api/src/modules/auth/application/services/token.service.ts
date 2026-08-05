import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@german-job-engine/shared-types';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository.interface';
import { AuthTokensDto } from '../dto/auth-tokens.dto';
import { JwtPayload } from '../dto/jwt-payload.interface';
import { hashToken } from '../../infrastructure/security/token-hash.util';
import { parseDurationToMs } from '../../infrastructure/security/parse-duration.util';

export interface TokenSubject {
  id: string;
  email: string;
  role: UserRole;
}

/** Issues and rotates access/refresh JWT pairs, persisting the refresh token's hash for revocation. */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async issueTokens(user: TokenSubject): Promise<AuthTokensDto> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn'),
    });

    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: refreshExpiresIn,
    });

    const expiresAt = new Date(Date.now() + parseDurationToMs(refreshExpiresIn));
    await this.refreshTokenRepository.store(user.id, hashToken(refreshToken), expiresAt);

    const tokens = new AuthTokensDto();
    tokens.accessToken = accessToken;
    tokens.refreshToken = refreshToken;
    return tokens;
  }

  async revokeTokens(userId: string): Promise<void> {
    await this.refreshTokenRepository.revoke(userId);
  }
}
