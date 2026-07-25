/**
 * Ekstrak error API berformat kontrak §1.4 dari error yang dilempar $fetch.
 * Body H3Error kita berbentuk { statusCode, message, data: { error: {...} } },
 * jadi payload kontrak ada di err.data.data.error (kadang err.data.error).
 */
export interface ApiError {
  code?: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  /** Payload tambahan per-kode, mis. `plans` pada PAYWALL_REQUIRED (§1.4). */
  details?: Record<string, unknown>;
}

export function apiErrorOf(err: unknown): ApiError {
  const data = (err as { data?: { data?: { error?: ApiError }; error?: ApiError } })?.data;
  const e = data?.data?.error ?? data?.error;
  if (e && typeof e.message === "string") return e;
  return { message: "Terjadi kesalahan. Silakan coba lagi." };
}

/** Petakan issues ZodError → { path.dot: pesan } untuk validasi klien. */
export function zodFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}
