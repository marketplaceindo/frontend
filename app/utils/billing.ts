/**
 * Aturan peringatan langganan (Fase 7d) — dipisah dari komponen supaya bisa
 * diuji tanpa merender UI. Selaras dengan reminder WA yang dikirim backend:
 * peringatan muncul saat mendekati jatuh tempo, dan menjadi mendesak saat
 * status `past_due`/`canceled`.
 */
import type { Subscription } from "@marketplaceindo/shared";

/** Ambang "mendekati jatuh tempo" (hari). */
export const DUE_SOON_DAYS = 14;

export interface SubscriptionWarning {
  tone: "warn" | "danger";
  text: string;
}

export function formatTanggal(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Sisa hari sampai periode berakhir; negatif berarti sudah lewat. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export function subscriptionWarning(
  subscription: Subscription | null,
  now: Date = new Date(),
): SubscriptionWarning | null {
  if (!subscription) return null;

  if (subscription.status === "past_due") {
    return {
      tone: "danger",
      text: "Pembayaran tertunggak. Situsmu bisa dinonaktifkan — segera perpanjang.",
    };
  }
  if (subscription.status === "canceled") {
    return {
      tone: "danger",
      text: "Langganan sudah berakhir. Perpanjang agar situs kembali online.",
    };
  }
  if (subscription.status !== "active") return null;

  const left = daysUntil(subscription.periodEnd, now);
  if (left > DUE_SOON_DAYS) return null;
  return {
    tone: "warn",
    text:
      left <= 0
        ? "Masa aktif habis hari ini. Perpanjang sekarang agar situs tetap online."
        : `Masa aktif berakhir ${left} hari lagi (${formatTanggal(subscription.periodEnd)}).`,
  };
}
