/**
 * Bentuk kunci cache ISR — fungsi murni, sengaja **bebas dependensi Nitro/h3**
 * supaya bisa diuji unit (pola yang sama dengan server/mock/*).
 * Pemakaiannya di runtime ada di `render-cache.ts`.
 */

/**
 * Pemisah subdomain dari sisa kunci. Memakai `__` karena:
 * - unstorage MENGHAPUS `:` dan `=` saat menormalkan nama key, jadi pemisah
 *   itu tidak bisa dipakai (kunci jadi menempel dan tak bisa di-purge tepat);
 * - `_` tidak pernah muncul di subdomain (RFC 1035: hanya a–z, 0–9, `-`),
 *   sehingga purge tenant `warung` tidak ikut menghapus `warung-budi`.
 */
export const KEY_SEPARATOR = "__";

/** Grup penyimpanan cache; dipakai endpoint revalidate untuk purge terarah. */
export const RENDER_CACHE_GROUP = "tenant";

/** Umur cache halaman publik tenant (detik) — sejalan `swr: 300` di plan. */
export const RENDER_CACHE_TTL = 300;

/** Susun kunci: subdomain di depan, lalu bagian query yang mempengaruhi hasil. */
export function buildRenderCacheKey(subdomain: string, parts: string[]): string {
  const safe = parts.filter(Boolean).map((value) => value.replace(/[^a-zA-Z0-9-]/g, "_"));
  return [subdomain, ...safe].join(KEY_SEPARATOR);
}

/** Cocokkan key cache dengan satu tenant (dipakai endpoint revalidate §11). */
export function isCacheKeyOfTenant(key: string, subdomain: string): boolean {
  return key.includes(`:${subdomain}${KEY_SEPARATOR}`) || key.endsWith(`:${subdomain}.json`);
}
