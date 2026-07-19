/**
 * Fase 4 — kalkulator kredit: angka benar untuk metode flat & efektif/anuitas
 * (DoD). Nilai referensi dihitung independen dengan rumus standar:
 * flat = pokok/tenor + pokok·rate/12 ; anuitas = pokok·i / (1 − (1+i)^−n).
 */
import { describe, expect, it } from "vitest";
import { hitungKredit } from "../app/utils/kredit";

describe("hitungKredit", () => {
  it("metode flat: harga 200jt, DP 20%, tenor 36, bunga 6%/th", () => {
    const r = hitungKredit({
      harga: 200_000_000,
      dpPersen: 20,
      tenorBulan: 36,
      bungaTahunanPersen: 6,
      metode: "flat",
    });
    expect(r.uangMuka).toBe(40_000_000);
    expect(r.pokokHutang).toBe(160_000_000);
    expect(r.angsuranPerBulan).toBe(5_244_444);
    expect(r.totalBunga).toBe(28_799_984); // efek pembulatan angsuran ke rupiah
    expect(r.totalPembayaran).toBe(5_244_444 * 36);
  });

  it("metode efektif (anuitas): parameter sama → angsuran lebih kecil", () => {
    const r = hitungKredit({
      harga: 200_000_000,
      dpPersen: 20,
      tenorBulan: 36,
      bungaTahunanPersen: 6,
      metode: "efektif",
    });
    expect(r.angsuranPerBulan).toBe(4_867_510);
    expect(r.totalBunga).toBe(15_230_360);
  });

  it("kasus kedua: harga 100jt, DP 10%, tenor 12, bunga 12%/th", () => {
    const flat = hitungKredit({
      harga: 100_000_000, dpPersen: 10, tenorBulan: 12, bungaTahunanPersen: 12, metode: "flat",
    });
    const anuitas = hitungKredit({
      harga: 100_000_000, dpPersen: 10, tenorBulan: 12, bungaTahunanPersen: 12, metode: "efektif",
    });
    expect(flat.angsuranPerBulan).toBe(8_400_000);
    expect(anuitas.angsuranPerBulan).toBe(7_996_391);
  });

  it("bunga 0% → kedua metode = pokok/tenor", () => {
    for (const metode of ["flat", "efektif"] as const) {
      const r = hitungKredit({
        harga: 120_000_000, dpPersen: 0, tenorBulan: 12, bungaTahunanPersen: 0, metode,
      });
      expect(r.angsuranPerBulan).toBe(10_000_000);
      expect(r.totalBunga).toBe(0);
    }
  });

  it("parameter di luar rentang → RangeError", () => {
    expect(() =>
      hitungKredit({ harga: 0, dpPersen: 20, tenorBulan: 36, bungaTahunanPersen: 6, metode: "flat" }),
    ).toThrow(RangeError);
    expect(() =>
      hitungKredit({ harga: 1, dpPersen: 100, tenorBulan: 36, bungaTahunanPersen: 6, metode: "flat" }),
    ).toThrow(RangeError);
  });
});
