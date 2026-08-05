import { Inject, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RefreshTokenCommand } from './refresh-token.command';
import { AuthTokensDto } from '../../dto/auth-tokens.dto';
import { TokenService } from '../../services/token.service';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../../../domain/repositories/refresh-token.repository.interface';
import { hashToken } from '../../../infrastructure/security/token-hash.util';
import { USER_REPOSITORY, UserRepository } from '../../../../users/domain/repositories/user.repository.interface';

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler implements ICommandHandler<RefreshTokenCommand> {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<AuthTokensDto> {
    const isValid = await this.refreshTokenRepository.isValid(
      command.userId,
      hashToken(command.refreshToken),
    );

    if (!isValid) {
      throw new UnauthorizedException('Refresh token is invalid or has been revoked');
    }

    const user = await this.userRepository.findById(command.userId);
    if (!user) {
      throw new UnauthorizedException('Refresh token is invalid or has been revoked');
    }

    return this.tokenService.issueTokens({
      id: user.id,
      email: user.email.value,
      role: user.role,
    });
  }
}
