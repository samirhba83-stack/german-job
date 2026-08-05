import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { LogoutCommand } from './logout.command';
import { TokenService } from '../../services/token.service';

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(private readonly tokenService: TokenService) {}

  async execute(command: LogoutCommand): Promise<void> {
    await this.tokenService.revokeTokens(command.userId);
  }
}
