/**
 * Fase 7d — aturan peringatan langganan (kontrak §9): mendekati jatuh tempo,
 * tertunggak, dan berakhir. Presentasi plan (tahunan = hero) diambil dari
 * konstanta shared, bukan angka yang ditulis ulang di frontend.
 */
import { describe, expect, it } from "vitest";
import { PLANS } from "@marketplaceindo/shared";
import { DUE_SOON_DAYS, daysUntil, subscriptionWarning } from "../app/utils/billing";

const NOW = new Date("2026-07-26T00:00:00Z");
const inDays = (n: number) =>
  new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

const sub = (over: Partial<Parameters<typeof subscriptionWarning>[0] & object> = {}) => ({
  plan: "yearly" as const,
  status: "active" as const,
  periodEnd: inDays(300),
  ...over,
});

describe("peringatan langganan", () => {
  it("tanpa langganan → tidak ada peringatan", () => {
    expect(subscriptionWarning(null, NOW)).toBeNull();
  });

  it("aktif dan masih lama → tidak mengganggu user", () => {
    expect(subscriptionWarning(sub(), NOW)).toBeNull();
    expect(subscriptionWarning(sub({ periodEnd: inDays(DUE_SOON_DAYS + 1) }), NOW)).toBeNull();
  });

  it("mendekati jatuh tempo → peringatan lembut berisi sisa hari", () => {
    const warning = subscriptionWarning(sub({ periodEnd: inDays(7) }), NOW);
    expect(warning?.tone).toBe("warn");
    expect(warning?.text).toContain("7 hari lagi");
  });

  it("tepat di ambang masih memicu peringatan", () => {
    expect(subscriptionWarning(sub({ periodEnd: inDays(DUE_SOON_DAYS) }), NOW)?.tone).toBe("warn");
  });

  it("habis hari ini / sudah lewat → pesan mendesak tanpa hitungan hari negatif", () => {
    const today = subscriptionWarning(sub({ periodEnd: inDays(0) }), NOW);
    expect(today?.text).toContain("habis hari ini");
    expect(subscriptionWarning(sub({ periodEnd: inDays(-3) }), NOW)?.text).toContain("habis hari ini");
  });

  it("past_due & canceled → peringatan mendesak", () => {
    expect(subscriptionWarning(sub({ status: "past_due" }), NOW)?.tone).toBe("danger");
    expect(subscriptionWarning(sub({ status: "canceled" }), NOW)?.tone).toBe("danger");
  });

  it("daysUntil membulatkan ke atas (sisa jam tetap dihitung sehari)", () => {
    expect(daysUntil(inDays(1), NOW)).toBe(1);
    expect(daysUntil(new Date(NOW.getTime() + 3 * 60 * 60 * 1000).toISOString(), NOW)).toBe(1);
  });
});

describe("presentasi plan (keputusan terkunci)", () => {
  it("tahunan = hero, harga & kanal dari konstanta shared", () => {
    expect(PLANS.yearly.hero).toBe(true);
    expect(PLANS.monthly.hero).toBe(false);
    expect(PLANS.yearly.price).toBe(300_000);
    expect(PLANS.monthly.price).toBe(30_000);
  });

  it("bulanan dibatasi QRIS/e-wallet; tahunan semua kanal", () => {
    expect([...PLANS.monthly.channels].sort()).toEqual(["ewallet", "qris"]);
    expect(PLANS.yearly.channels).toEqual(expect.arrayContaining(["qris", "ewallet", "va", "card"]));
  });

  it("hemat tahunan dibulatkan ke 17% (setara 10 bulan)", () => {
    const saving = Math.round((1 - PLANS.yearly.price / (PLANS.monthly.price * 12)) * 100);
    expect(saving).toBe(17);
  });
});
