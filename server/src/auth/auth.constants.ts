/** Session lifetimes. */
export const SESSION_SLIDING_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, extended on refresh
export const SESSION_ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, hard cap

/** Password policy. Max length caps argon2 input to prevent a memory-DoS. */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** Per-account lockout with exponential backoff. */
export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_BASE_MS = 60 * 1000; // 1 minute
export const LOCKOUT_MAX_MS = 15 * 60 * 1000; // 15 minutes

/**
 * argon2id parameters — OWASP Password Storage baseline (m=19 MiB, t=2, p=1).
 * `algorithm` is omitted because @node-rs/argon2 defaults to Argon2id.
 */
export const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};
