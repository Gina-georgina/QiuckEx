/**
 * Backend origin for browser calls. Override in `.env.local`:
 * `NEXT_PUBLIC_QUICKEX_API_URL=https://api.example.com`
 */
export const getQuickexApiBase = (): string =>
  process.env.NEXT_PUBLIC_QUICKEX_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

export type UsernameAvailabilityStatus =
  | "available"
  | "taken"
  | "invalid"
  | "rate-limited"
  | "error";

export interface UsernameAvailabilityResult {
  status: UsernameAvailabilityStatus;
  available: boolean;
  message: string;
}

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;
const USERNAME_PATTERN = /^[a-zA-Z0-9]+$/;

/**
 * Client-side validation for a username. Returns `null` when the value is
 * valid, otherwise a human-readable reason.
 */
export const validateUsername = (name: string): string | null => {
  if (name.length < USERNAME_MIN_LENGTH) {
    return `Must be at least ${USERNAME_MIN_LENGTH} characters`;
  }
  if (name.length > USERNAME_MAX_LENGTH) {
    return `Must be at most ${USERNAME_MAX_LENGTH} characters`;
  }
  if (!USERNAME_PATTERN.test(name)) {
    return "Only letters and numbers are allowed";
  }
  return null;
};

/**
 * Check whether a username is available via
 * `GET /usernames/{name}/available`.
 *
 * Invalid usernames are rejected client-side without hitting the API.
 * A 429 response is surfaced as `rate-limited` so callers can show a
 * friendly "Try again shortly" message.
 */
export const checkUsernameAvailability = async (
  name: string,
  signal?: AbortSignal,
): Promise<UsernameAvailabilityResult> => {
  const invalidReason = validateUsername(name);
  if (invalidReason) {
    return { status: "invalid", available: false, message: invalidReason };
  }

  try {
    const response = await fetch(
      `${getQuickexApiBase()}/usernames/${encodeURIComponent(name)}/available`,
      { method: "GET", signal, headers: { Accept: "application/json" } },
    );

    if (response.status === 429) {
      return {
        status: "rate-limited",
        available: false,
        message: "Try again shortly",
      };
    }

    if (!response.ok) {
      return {
        status: "error",
        available: false,
        message: "Could not check availability",
      };
    }

    const data = (await response.json()) as { available?: boolean };
    const available = Boolean(data?.available);
    return {
      status: available ? "available" : "taken",
      available,
      message: available ? "Available" : "Already claimed",
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return {
      status: "error",
      available: false,
      message: "Could not check availability",
    };
  }
};
