import { ConflictException, Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { UserRole } from '@german-job-engine/shared-types';
import { CreateUserCommand } from './create-user.command';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository.interface';
import { PASSWORD_HASHER, PasswordHasher } from '../../ports/password-hasher.port';
import { Email } from '../../../domain/value-objects/email.vo';
import { User } from '../../../domain/entities/user.entity';
import { EmailAlreadyExistsException } from '../../../domain/exceptions/email-already-exists.exception';

export interface CreateUserResult {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateUserCommand): Promise<CreateUserResult> {
    const email = Email.create(command.email);

    const existing = await this.userRepository.findByEmail(email.value);
    if (existing) {
      throw new ConflictException(new EmailAlreadyExistsException(email.value).message);
    }

    const passwordHash = await this.passwordHasher.hash(command.password);

    const user = User.create(randomUUID(), {
      email,
      passwordHash,
      role: UserRole.CANDIDATE,
      createdAt: new Date(),
    });

    await this.userRepository.save(user);
    user.domainEvents.forEach((event) => this.eventBus.publish(event));
    user.clearDomainEvents();

    return {
      id: user.id,
      email: user.email.value,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
