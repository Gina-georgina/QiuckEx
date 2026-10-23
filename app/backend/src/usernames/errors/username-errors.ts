/**
 * Username-specific errors for deterministic conflict and validation handling.
 */

export enum UsernameErrorCode {
  /** Username is already taken (uniqueness conflict). */
  CONFLICT = 'USERNAME_CONFLICT',
  /** Wallet has reached the maximum allowed usernames. */
  LIMIT_EXCEEDED = 'USERNAME_LIMIT_EXCEEDED',
  /** Username format invalid (length or pattern). */
  INVALID_FORMAT = 'USERNAME_INVALID_FORMAT',
  /** Username not found. */
  NOT_FOUND = 'USERNAME_NOT_FOUND',
  /** Claim signature is invalid, expired, or not backed by a Stellar account. */
  CLAIM_INVALID = 'USERNAME_CLAIM_INVALID',
  /** Profile settings conflict (e.g. duplicate or stale write). */
  PROFILE_CONFLICT = 'PROFILE_CONFLICT',
  /** Profile settings are not owned by the requesting wallet. */
  PROFILE_NOT_OWNED = 'PROFILE_NOT_OWNED',
  /** Profile settings payload is malformed. */
  PROFILE_MALFORMED = 'PROFILE_MALFORMED',
  /** A dependency required to persist profile settings failed. */
  PROFILE_DEPENDENCY_FAILURE = 'PROFILE_DEPENDENCY_FAILURE',
  /** Idempotency key was reused with a different payload. */
  PROFILE_IDEMPOTENCY_CONFLICT = 'PROFILE_IDEMPOTENCY_CONFLICT',
}

export class UsernameConflictError extends Error {
  constructor(
    public readonly username: string,
    message = `Username "${username}" is already taken`,
  ) {
    super(message);
    this.name = 'UsernameConflictError';
  }
}

export class UsernameLimitExceededError extends Error {
  constructor(
    public readonly publicKey: string,
    public readonly limit: number,
    message?: string,
  ) {
    super(
      message ??
        `Wallet has reached the maximum of ${limit} username(s). Cannot register more.`,
    );
    this.name = 'UsernameLimitExceededError';
  }
}

export class UsernameValidationError extends Error {
  constructor(
    public code: UsernameErrorCode,
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = 'UsernameValidationError';
  }
}

export class UsernameClaimInvalidError extends Error {
  constructor(message = 'Username claim signature is invalid or expired') {
    super(message);
    this.name = 'UsernameClaimInvalidError';
  }
}

export class ProfileConflictError extends Error {
  constructor(
    public readonly code: UsernameErrorCode = UsernameErrorCode.PROFILE_CONFLICT,
    message = 'Profile settings conflict',
  ) {
    super(message);
    this.name = 'ProfileConflictError';
  }
}

export class ProfileNotOwnedError extends Error {
  constructor(
    public readonly code: UsernameErrorCode = UsernameErrorCode.PROFILE_NOT_OWNED,
    message = 'Profile settings are not owned by the requesting wallet',
  ) {
    super(message);
    this.name = 'ProfileNotOwnedError';
  }
}

export class ProfileMalformedError extends Error {
  constructor(
    public readonly code: UsernameErrorCode = UsernameErrorCode.PROFILE_MALFORMED,
    message = 'Profile settings payload is malformed',
    public field?: string,
  ) {
    super(message);
    this.name = 'ProfileMalformedError';
  }
}

export class ProfileDependencyFailureError extends Error {
  constructor(
    public readonly code: UsernameErrorCode = UsernameErrorCode.PROFILE_DEPENDENCY_FAILURE,
    message = 'A dependency required to persist profile settings failed',
  ) {
    super(message);
    this.name = 'ProfileDependencyFailureError';
  }
}

export class ProfileIdempotencyConflictError extends Error {
  constructor(
    public readonly code: UsernameErrorCode = UsernameErrorCode.PROFILE_IDEMPOTENCY_CONFLICT,
    message = 'Idempotency key was reused with a different payload',
  ) {
    super(message);
    this.name = 'ProfileIdempotencyConflictError';
  }
}
