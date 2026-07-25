import type { Request } from 'express';

/** Client metadata captured on a session for audit/security context. */
export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export function requestMeta(req: Request): RequestMeta {
  return {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };
}
