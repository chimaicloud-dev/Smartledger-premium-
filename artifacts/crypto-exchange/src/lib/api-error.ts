/**
 * Extracts a clean, user-friendly message from an API error.
 *
 * The generated API client throws errors whose `.message` is prefixed with
 * "HTTP 400 Bad Request: ..." — never show that raw string to users.
 * This helper pulls the server's actual message (e.g. "Email already in use",
 * "Insufficient balance") and falls back to the provided default.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;

  const anyErr = err as { data?: unknown; message?: unknown };

  // ApiError carries the parsed response body on `.data`
  if (anyErr.data && typeof anyErr.data === "object") {
    const body = anyErr.data as Record<string, unknown>;
    for (const key of ["message", "error"]) {
      const v = body[key];
      // Skip machine codes like "KYC_REQUIRED" in favor of `message`
      if (typeof v === "string" && v.trim() && !/^[A-Z0-9_]+$/.test(v.trim())) {
        return v.trim();
      }
    }
  }

  // Fall back to the error message with any "HTTP 400 Bad Request:" prefix stripped
  if (typeof anyErr.message === "string" && anyErr.message.trim()) {
    const stripped = anyErr.message.replace(/^HTTP \d{3}[^:]*:\s*/i, "").trim();
    if (stripped && !/^HTTP \d{3}/i.test(stripped)) return stripped;
  }

  return fallback;
}
