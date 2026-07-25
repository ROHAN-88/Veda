import type { Request } from 'express';

/** A user shape safe to return to clients — never includes `passwordHash`. */
export interface SafeUser {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Express request after {@link SessionAuthGuard} has authenticated it. */
export interface AuthenticatedRequest extends Request {
  user: SafeUser;
  /** sha256 of the active session token (set by the guard). */
  sessionTokenHash?: string;
}

/** Maps a persisted user row to the client-safe projection. */
export function toSafeUser(user: {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
