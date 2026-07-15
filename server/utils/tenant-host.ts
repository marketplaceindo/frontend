import { subdomainSchema } from "@marketplaceindo/shared";
import type { TenantRouting } from "../../shared/types/tenant-routing";

/**
 * Label yang SELALU milik platform (mode dashboard), bukan situs tenant.
 * Catatan: SUBDOMAIN_BLACKLIST di package shared adalah aturan REGISTRASI
 * (nama yang tidak boleh diambil user); routing hanya perlu memisahkan host
 * dashboard — subdomain terdaftar lain (termasuk seed milik platform seperti
 * `demo`) tetap di-resolve sebagai tenant lalu 404 bila tidak ada.
 */
const DASHBOARD_LABELS = new Set(["app", "www"]);

/**
 * Resolusi Host header → mode aplikasi (dashboard vs situs tenant).
 * - `lvh.me` / `app.lvh.me` / `www.lvh.me`  → dashboard
 * - `demo.lvh.me`                            → tenant "demo"
 * - Host di luar baseDomains (IP, domain asing) → dashboard
 *   (custom domain per-tenant = fase produk 3, belum di-handle di sini).
 */
export function resolveTenantFromHost(
  rawHost: string | null | undefined,
  baseDomains: readonly string[],
): TenantRouting {
  if (!rawHost) return { mode: "dashboard" };

  // Buang port dan trailing dot FQDN, normalisasi lowercase.
  const host = rawHost.split(":")[0]!.replace(/\.$/, "").toLowerCase();

  for (const base of baseDomains) {
    if (host === base) return { mode: "dashboard" };
    if (!host.endsWith(`.${base}`)) continue;

    const label = host.slice(0, -(base.length + 1));
    // Multi-level (a.b.lvh.me) bukan subdomain tenant yang sah.
    if (label.includes(".")) return { mode: "dashboard" };
    if (DASHBOARD_LABELS.has(label)) return { mode: "dashboard" };
    if (!subdomainSchema.safeParse(label).success) return { mode: "dashboard" };
    return { mode: "tenant", subdomain: label };
  }

  return { mode: "dashboard" };
}

/** Daftar base domain yang dikenali: domain produksi (dari config) + host dev. */
export function knownBaseDomains(configuredBaseDomain: string): string[] {
  return [...new Set([configuredBaseDomain, "lvh.me", "localhost"])];
}
