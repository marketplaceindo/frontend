/**
 * Error mock berformat kontrak §1.4 — modul tersendiri supaya tenant-store,
 * content-store, media-store, dan billing-store bisa memakainya tanpa saling
 * mengimpor (menghindari siklus).
 */
export class TenantApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TenantApiError";
  }
}
