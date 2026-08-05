import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { LoginCommand } from './login.command';
import { AuthTokensDto } from '../../dto/auth-tokens.dto';
import { TokenService } from '../../services/token.service';

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(private readonly tokenService: TokenService) {}

  async execute(command: LoginCommand): Promise<AuthTokensDto> {
    return this.tokenService.issueTokens({
      id: command.userId,
      email: command.email,
      role: command.role,
    });
  }
}
