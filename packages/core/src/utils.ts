/**
 * Sanitize a value for the ai.txt text format.
 * Prevents newline injection and strips control characters.
 */
export function sanitizeValue(value: unknown, maxLength = 500): string {
  const str = typeof value === "string" ? value : String(value ?? "");
  return str
    .replace(/[\r\n]/g, " ")
    .replace(/[\x00-\x1f]/g, "")
    .trim()
    .slice(0, maxLength);
}

/**
 * Parse a rate limit string like "60/minute" into components.
 */
export function parseRateLimit(value: string): { requests: number; window: string } | null {
  const match = value.match(/^(\d+)\/(second|minute|hour|day)$/);
  if (!match) return null;
  const requests = parseInt(match[1], 10);
  if (requests <= 0) return null;
  return { requests, window: match[2] };
}

/**
 * Format a rate limit as "60/minute".
 */
export function formatRateLimit(requests: number, window: string): string {
  return `${requests}/${window}`;
}
