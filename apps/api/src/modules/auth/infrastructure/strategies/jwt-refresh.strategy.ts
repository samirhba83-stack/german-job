import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { JwtPayload } from '../../application/dto/jwt-payload.interface';

export interface JwtRefreshPayload extends JwtPayload {
  refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.refreshSecret') as string,
      passReqToCallback: true,
    });
  }

  // Signature-verified, expiry-checked payload; the stored-hash / revocation check happens
  // in RefreshTokenHandler, since that's a persistence concern, not a token-format concern.
  async validate(req: Request, payload: JwtPayload): Promise<JwtRefreshPayload> {
    const refreshToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req) as string;
    return { ...payload, refreshToken };
  }
}
