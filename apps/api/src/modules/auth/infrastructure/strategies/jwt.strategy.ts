import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../application/dto/jwt-payload.interface';
import { USER_REPOSITORY, UserRepository } from '../../../users/domain/repositories/user.repository.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret') as string,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // M31 Phase 20/27 — real, immediate account suspension enforcement (Emergency Stop "disable
    // one user"): checked on EVERY authenticated request, not just at login, so a suspended
    // user's already-issued access token stops working immediately rather than remaining valid
    // until it naturally expires. A real DB round trip on every request is a deliberate,
    // necessary cost for this guarantee — `getAccountStatus()` is a single-row, indexed lookup by
    // primary key, not a full entity reconstruction.
    const status = await this.users.getAccountStatus(payload.sub);
    if (!status) {
      throw new UnauthorizedException('Account not found.');
    }
    if (status.suspended) {
      throw new UnauthorizedException('This account has been suspended.');
    }
    // Signature/expiry already verified by passport-jwt; payload becomes `request.user`.
    return payload;
  }
}
