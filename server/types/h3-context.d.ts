import type { TenantRouting } from "../../shared/types/tenant-routing";

declare module "h3" {
  interface H3EventContext {
    /**
     * Diisi server/plugins/tenant.ts untuk SEMUA request (parsing Host).
     * tenantId uuid baru diketahui setelah lookup ke backend, bukan di sini.
     */
    tenant?: TenantRouting;
  }
}
