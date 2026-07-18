import type { Cta } from "@marketplaceindo/shared";

/** Kelas tombol CTA per varian — semua warna dari token theme (bukan hardcode). */
export function ctaClass(variant?: Cta["variant"]): string {
  const base =
    "inline-block rounded-theme px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-85";
  switch (variant) {
    case "secondary":
      return `${base} bg-secondary text-white`;
    case "outline":
      return `${base} border border-primary text-primary`;
    default:
      return `${base} bg-primary text-white`;
  }
}
