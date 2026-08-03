/**
 * Instrumentasi funnel onboarding.
 *
 * Sengaja tanpa vendor: satu titik kirim yang bisa disambungkan ke penyedia
 * analitik mana pun nanti tanpa menyentuh komponen. Di browser, tiap event juga
 * disiarkan sebagai `CustomEvent` pada `window` supaya test end-to-end bisa
 * menegaskan payload-nya tanpa jaringan.
 *
 * Step pemilih model adalah kandidat drop-off terbesar di seluruh wizard —
 * tanpa event di bawah ini kita tidak akan pernah tahu di mana user berhenti,
 * dan itu memblokir keputusan "boleh menambah merk kedua atau belum".
 */

export type AnalyticsEvent =
  | { name: "wizard_vertical_selected"; vertical: "mobil" | "motor" | "bekas" | "keduanya" }
  | { name: "wizard_brand_selected"; brandSlug: string }
  | { name: "wizard_city_selected"; cityCode: string; hasExactPrice: boolean }
  | { name: "wizard_models_selected"; count: number; variantCount: number }
  | { name: "seed_inventory_done"; createdVariants: number; warningCount: number };

/** Nama event browser tempat payload disiarkan. */
export const ANALYTICS_CHANNEL = "marketindonesia:analytics";

export function trackEvent(event: AnalyticsEvent): void {
  if (import.meta.server) return;
  window.dispatchEvent(new CustomEvent(ANALYTICS_CHANNEL, { detail: event }));
  if (import.meta.dev) console.info("[analytics]", event.name, event);
}
