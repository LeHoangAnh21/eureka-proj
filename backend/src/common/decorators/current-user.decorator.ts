import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface AuthRequest {
  user: Record<string, unknown>;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Record<string, unknown> => {
    const request = ctx.switchToHttp().getRequest<AuthRequest>();
    return request.user;
  },
);
