import { CommandHandler, CommandBus, ICommandHandler } from '@nestjs/cqrs';
import { RegisterCommand } from './register.command';
import { AuthTokensDto } from '../../dto/auth-tokens.dto';
import { TokenService } from '../../services/token.service';
import { CreateUserCommand } from '../../../../users/application/commands/create-user/create-user.command';
import { CreateUserResult } from '../../../../users/application/commands/create-user/create-user.handler';

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly tokenService: TokenService,
  ) {}

  async execute(command: RegisterCommand): Promise<AuthTokensDto> {
    const user = await this.commandBus.execute<CreateUserCommand, CreateUserResult>(
      new CreateUserCommand(command.email, command.password),
    );

    return this.tokenService.issueTokens(user);
  }
}
