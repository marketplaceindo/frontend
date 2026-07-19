import type { TenantRouting } from "../../shared/types/tenant-routing";

/**
 * Mode routing dihitung server-side dari Host (server/plugins/tenant.ts) dan
 * dibekukan di state — host tidak berubah selama navigasi client-side.
 */
export function useTenantRouting() {
  return useState<TenantRouting>("tenant-routing", () => {
    if (import.meta.server) {
      const fromHost = useRequestEvent()?.context.tenant as TenantRouting | undefined;
      return fromHost ?? { mode: "dashboard" };
    }
    return { mode: "dashboard" };
  });
}

/**
 * Error dari $fetch route internal membungkus payload kontrak §1.4 di lapisan
 * .data.data.error — lempar ulang sebagai error halaman dengan code/message asli.
 */
export function rethrowRenderError(error: {
  statusCode?: number;
  message: string;
  data?: unknown;
}): never {
  const nested = error.data as
    | { data?: { error?: { code?: string; message?: string } } }
    | undefined;
  const apiError = nested?.data?.error;
  throw createError({
    statusCode: error.statusCode ?? 500,
    message: apiError?.message ?? error.message,
    data: apiError ? { error: apiError } : error.data,
    fatal: true,
  });
}
