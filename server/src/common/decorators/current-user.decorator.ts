import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, SafeUser } from '../types/authenticated-request';

/** Injects the authenticated user attached by {@link SessionAuthGuard}. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SafeUser => {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.user;
  },
);
