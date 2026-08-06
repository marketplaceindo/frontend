import type { Cta } from "@marketplaceindo/shared";

/**
 * Kelas tombol CTA per varian — semua warna dari token theme (bukan hardcode).
 *
 * `text-on-primary` menggantikan `text-white` yang dipakai sebelumnya: warna
 * itu dihitung kontrasnya dari `primaryColor` tenant (lihat pickOnColor di
 * theme-vars.ts), jadi tenant yang memilih warna utama pucat tidak lagi
 * mendapat tombol putih-di-atas-terang yang tak terbaca.
 */
export function ctaClass(variant?: Cta["variant"]): string {
  const base =
    "mi-cta inline-flex items-center justify-center gap-2 rounded-theme px-5 py-2.5 text-sm font-semibold";
  switch (variant) {
    case "secondary":
      return `${base} bg-secondary text-white`;
    case "outline":
      return `${base} mi-cta-outline border border-primary text-primary`;
    default:
      return `${base} bg-primary text-on-primary`;
  }
}
