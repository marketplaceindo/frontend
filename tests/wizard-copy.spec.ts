/**
 * Salinan teks wizard mengikuti jenis usaha yang dipilih user.
 *
 * Bug yang ditangkap: dealer mobil melihat placeholder "Nasi Goreng Spesial"
 * dan label "Harga" untuk mobil seharga ratusan juta. Itu membuat user ragu
 * apakah ia salah memilih jenis usaha — persis di step yang menentukan isi
 * situsnya.
 */
import { describe, expect, it } from "vitest";
import { BUSINESS_TYPES } from "@marketplaceindo/shared";
import { ANDALAN_COPY, andalanCopyFor } from "../app/utils/wizard-copy";

describe("salinan step andalan per jenis usaha", () => {
  it("setiap jenis usaha punya salinannya sendiri", () => {
    for (const type of BUSINESS_TYPES) {
      expect(ANDALAN_COPY[type], `salinan untuk "${type}" belum ditulis`).toBeTruthy();
    }
    expect(Object.keys(ANDALAN_COPY).sort()).toEqual([...BUSINESS_TYPES].sort());
  });

  it("otomotif TIDAK memakai contoh kuliner", () => {
    const oto = andalanCopyFor("otomotif");
    expect(oto.placeholder).not.toMatch(/nasi|goreng|menu/i);
    expect(oto.label).toBe("Unit");
    expect(oto.labelHarga).toBe("Harga OTR");
    // Contoh harga harus masuk akal untuk mobil, bukan seporsi makanan.
    expect(Number(oto.placeholderHarga)).toBeGreaterThan(50_000_000);
  });

  it("kuliner memakai kata & contoh kuliner", () => {
    const kul = andalanCopyFor("kuliner");
    expect(kul.label).toBe("Menu");
    expect(Number(kul.placeholderHarga)).toBeLessThan(1_000_000);
  });

  it("tiap jenis usaha memakai kata benda yang berbeda", () => {
    const label = BUSINESS_TYPES.map((t) => andalanCopyFor(t).label);
    expect(new Set(label).size).toBe(BUSINESS_TYPES.length);
  });

  it("sebelum jenis usaha dipilih tetap mengembalikan salinan yang valid", () => {
    expect(andalanCopyFor("").label).toBeTruthy();
  });

  it("tidak ada teks yang tertinggal kosong", () => {
    for (const type of BUSINESS_TYPES) {
      for (const [field, value] of Object.entries(andalanCopyFor(type))) {
        expect(value, `${type}.${field} kosong`).not.toBe("");
      }
    }
  });
});
