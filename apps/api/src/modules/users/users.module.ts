import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UsersController } from './presentation/controllers/users.controller';
import { CreateUserHandler } from './application/commands/create-user/create-user.handler';
import { GetUserHandler } from './application/queries/get-user/get-user.handler';
import { USER_REPOSITORY } from './domain/repositories/user.repository.interface';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port';
import { BcryptPasswordHasher } from './infrastructure/security/bcrypt-password-hasher';

const commandHandlers = [CreateUserHandler];
const queryHandlers = [GetUserHandler];

@Module({
  imports: [CqrsModule],
  controllers: [UsersController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
  ],
  exports: [USER_REPOSITORY, PASSWORD_HASHER],
})
export class UsersModule {}
