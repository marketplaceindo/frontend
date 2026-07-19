import type { RenderTenantResponse } from "@marketplaceindo/shared";

/**
 * Data global situs tenant (theme, nav, kontak) — di-set SiteEntry setelah
 * fetch render API, dibaca block yang butuh konteks situs (mis. nomor WA
 * untuk CTA unit kendaraan).
 */
export function useTenantSite() {
  return useState<RenderTenantResponse | null>("tenant-site", () => null);
}
