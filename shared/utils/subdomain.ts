/**
 * Normalisasi kandidat subdomain — dipakai wizard (saran otomatis dari nama
 * usaha, sanitasi saat mengetik) dan mock tenant store. Aturan format yang
 * MENGIKAT tetap `subdomainSchema` di @marketplaceindo/shared; ini hanya
 * membentuk input mentah user menjadi kandidat yang layak dicek.
 */

/** Panjang minimum kebijakan produk (RFC 1035 sendiri mengizinkan 1 karakter). */
export const MIN_SUBDOMAIN_LENGTH = 3;

export function normalizeSubdomain(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[\s_.]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}
