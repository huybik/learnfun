/**
 * Merge class names. Filters out falsy values.
 * Simple alternative to clsx — no external dependency needed.
 */
export function cn(...inputs: (string | false | null | undefined)[]): string {
  return inputs.filter(Boolean).join(" ");
}

/** Returns a promise that resolves after `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Options for the retry helper. */
export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in ms before first retry (default: 500) */
  baseDelay?: number;
  /** Maximum delay cap in ms (default: 10000) */
  maxDelay?: number;
}

/**
 * Retry an async function with exponential backoff.
 * Throws the last error if all attempts fail.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelay = 500, maxDelay = 10_000 } = opts;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}
