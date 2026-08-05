import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUserQuery } from '../../application/queries/get-user/get-user.query';
import { UserResponseDto } from '../../application/dto/user-response.dto';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { JwtPayload } from '../../../auth/application/dto/jwt-payload.interface';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly queryBus: QueryBus) {}

  @ApiOperation({ summary: 'Get a user by id — self or Admin only' })
  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<UserResponseDto> {
    return this.queryBus.execute(new GetUserQuery(id, user.role, user.sub));
  }
}
