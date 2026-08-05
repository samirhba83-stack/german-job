import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { USER_REPOSITORY, UserRepository } from '../../../users/domain/repositories/user.repository.interface';
import { PASSWORD_HASHER, PasswordHasher } from '../../../users/application/ports/password-hasher.port';
import { TokenSubject } from '../../application/services/token.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
  ) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<TokenSubject> {
    const user = await this.userRepository.findByEmail(email.trim().toLowerCase());

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await this.passwordHasher.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return { id: user.id, email: user.email.value, role: user.role };
  }
}
