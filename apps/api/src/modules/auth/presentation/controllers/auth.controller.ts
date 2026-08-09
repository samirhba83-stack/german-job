import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Throttle } from '@nestjs/throttler';
import { RegisterDto } from '../../application/dto/register.dto';
import { LoginDto } from '../../application/dto/login.dto';
import { AuthTokensDto } from '../../application/dto/auth-tokens.dto';
import { RegisterCommand } from '../../application/commands/register/register.command';
import { LoginCommand } from '../../application/commands/login/login.command';
import { RefreshTokenCommand } from '../../application/commands/refresh-token/refresh-token.command';
import { LogoutCommand } from '../../application/commands/logout/logout.command';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { JwtRefreshGuard } from '../guards/jwt-refresh.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { TokenSubject } from '../../application/services/token.service';
import { JwtRefreshPayload } from '../../infrastructure/strategies/jwt-refresh.strategy';
import { JwtPayload } from '../../application/dto/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  /** Stricter than the global default (100/60s) — registration is the one fully public write
   * endpoint with no auth in front of it at all, the highest-value target for automated abuse. */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<AuthTokensDto> {
    return this.commandBus.execute(new RegisterCommand(dto.email, dto.password, dto.invitationCode));
  }

  /** Stricter than the global default — the primary credential-stuffing / brute-force target. */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() _dto: LoginDto, @CurrentUser() user: TokenSubject): Promise<AuthTokensDto> {
    return this.commandBus.execute(new LoginCommand(user.id, user.email, user.role));
  }

  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@CurrentUser() user: JwtRefreshPayload): Promise<AuthTokensDto> {
    return this.commandBus.execute(new RefreshTokenCommand(user.sub, user.refreshToken));
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.commandBus.execute(new LogoutCommand(user.sub));
  }
}
