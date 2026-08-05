import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Extracts the authenticated user attached to the request by the JWT auth guard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
