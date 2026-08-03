/**
 * Fase 7c butir 4 — editor model & varian kendaraan baru.
 *
 * Tiga aturan di bawah menentukan apakah angka yang dilihat pembeli boleh
 * disebut OTR pasti, dan apakah tabel compare bisa dipercaya. Karena itu
 * diuji sebagai logika murni, bukan lewat komponen.
 */
import { describe, expect, it } from "vitest";
import { specKeysFor, type City, type VehicleVariant } from "@marketplaceindo/shared";
import {
  duplikatVarian,
  jumlahBelumTerbit,
  setHargaKota,
  specFieldGroups,
  specKosongDiVarianLain,
  terapkanSelisihSemuaKota,
  varianBaru,
} from "../app/utils/vehicle-model-editor";

const KOTA: City[] = [
  { code: "JKT", name: "Jakarta" },
  { code: "BDG", name: "Bandung" },
];

function keySemua(vertical: "mobil" | "motor"): string[] {
  return specFieldGroups(vertical).flatMap((g) => g.fields.map((f) => f.key));
}

// ---------------------------------------------------------------------------

describe("form spesifikasi difilter per vertikal (§7.3)", () => {
  it("motor menampilkan kaki.tipe_rangka dan TIDAK menampilkan jumlah airbag", () => {
    const keys = keySemua("motor");
    expect(keys).toContain("kaki.tipe_rangka");
    expect(keys).not.toContain("keselamatan.jumlah_airbag");
  });

  it("mobil menampilkan jumlah airbag dan TIDAK menampilkan kaki.tipe_rangka", () => {
    const keys = keySemua("mobil");
    expect(keys).toContain("keselamatan.jumlah_airbag");
    expect(keys).not.toContain("kaki.tipe_rangka");
  });

  it("field yang ditampilkan persis sama dengan specKeysFor(vertical)", () => {
    // Kalau keduanya bisa berbeda, editor akan menyimpan key yang ditolak 422.
    for (const vertical of ["mobil", "motor"] as const) {
      expect(keySemua(vertical).sort()).toEqual([...specKeysFor(vertical)].sort());
    }
  });

  it("dikelompokkan per group dan tidak ada grup kosong", () => {
    const grup = specFieldGroups("motor");
    expect(grup.length).toBeGreaterThan(1);
    for (const g of grup) expect(g.fields.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------

describe("duplikat varian", () => {
  function varianKatalog(): VehicleVariant {
    return {
      ...varianBaru("Ultimate CVT", 2, KOTA),
      catalogVariantId: "c0000000-0000-4000-8000-000000000001",
      priceSource: "catalog",
      priceUpdatedAt: "2026-07-01T00:00:00Z",
      priceEstimated: true,
      priceEstimatedFromCity: "Semarang",
      isFeatured: true,
      specs: { "mesin.kapasitas_cc": 1499 },
      highlights: ["Kamera 360°"],
    };
  }

  it("melepas catalogVariantId dan mengembalikan priceSource ke manual", () => {
    const salinan = duplikatVarian(varianKatalog(), { now: "2026-08-01T00:00:00Z" });

    expect(salinan.catalogVariantId).toBeUndefined();
    expect(salinan.priceSource).toBe("manual");
    expect(salinan.priceEstimated).toBe(false);
    expect(salinan.priceEstimatedFromCity).toBeUndefined();
  });

  it("menyalin spec & harga tapi memberi id/slug/nama baru", () => {
    const sumber = varianKatalog();
    const salinan = duplikatVarian(sumber, { nama: "Exceed CVT" });

    expect(salinan.id).not.toBe(sumber.id);
    expect(salinan.name).toBe("Exceed CVT");
    expect(salinan.slug).toBe("exceed-cvt");
    // Isi yang memang ingin dipakai ulang tetap terbawa — itu gunanya duplikat.
    expect(salinan.specs).toEqual(sumber.specs);
    expect(salinan.priceOtr).toEqual(sumber.priceOtr);
    expect(salinan.highlights).toEqual(sumber.highlights);
  });

  it("salinan tidak mewarisi status unggulan & naik satu trimRank", () => {
    const salinan = duplikatVarian(varianKatalog());
    expect(salinan.isFeatured).toBe(false);
    expect(salinan.trimRank).toBe(3);
  });

  it("mengubah salinan tidak mengubah sumbernya", () => {
    const sumber = varianKatalog();
    const salinan = duplikatVarian(sumber);
    (salinan.specs as Record<string, number>)["mesin.kapasitas_cc"] = 1329;
    expect((sumber.specs as Record<string, number>)["mesin.kapasitas_cc"]).toBe(1499);
  });
});

// ---------------------------------------------------------------------------

describe("harga manual mematikan status estimasi", () => {
  function varianEstimasi(): VehicleVariant {
    return {
      ...varianBaru("Tipe G", 0, KOTA),
      priceSource: "catalog",
      priceEstimated: true,
      priceEstimatedFromCity: "Semarang",
      priceUpdatedAt: "2026-07-01T00:00:00Z",
    };
  }

  it("set harga satu kota → priceEstimated false, priceSource manual", () => {
    const hasil = setHargaKota(varianEstimasi(), "JKT", 250_000_000, {
      now: "2026-08-01T00:00:00Z",
    });

    expect(hasil.priceEstimated).toBe(false);
    expect(hasil.priceSource).toBe("manual");
    expect(hasil.priceEstimatedFromCity).toBeUndefined();
    expect(hasil.priceUpdatedAt).toBe("2026-08-01T00:00:00Z");
    expect(hasil.priceOtr.find((p) => p.cityCode === "JKT")?.price).toBe(250_000_000);
  });

  it("kota yang belum ada di daftar ikut ditambahkan", () => {
    const hasil = setHargaKota(varianEstimasi(), "SBY", 260_000_000, { cityName: "Surabaya" });
    expect(hasil.priceOtr.find((p) => p.cityCode === "SBY")).toEqual({
      cityCode: "SBY",
      cityName: "Surabaya",
      price: 260_000_000,
    });
  });

  it("terapkan selisih ke semua kota juga mematikan estimasi", () => {
    const hasil = terapkanSelisihSemuaKota(
      setHargaKota(varianEstimasi(), "JKT", 250_000_000),
      2_000_000,
    );
    expect(hasil.priceEstimated).toBe(false);
    expect(hasil.priceSource).toBe("manual");
    expect(hasil.priceOtr.find((p) => p.cityCode === "JKT")?.price).toBe(252_000_000);
  });

  it("selisih negatif tidak pernah menghasilkan harga di bawah nol", () => {
    const hasil = terapkanSelisihSemuaKota(varianEstimasi(), -999_000_000);
    for (const p of hasil.priceOtr) expect(p.price).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe("indikator spesifikasi bolong & checklist publikasi", () => {
  it("menandai key yang kosong di varian ini tapi terisi di varian lain", () => {
    const variants = [
      { specs: { "mesin.kapasitas_cc": 1499, "fitur.keyless": true } },
      { specs: { "mesin.kapasitas_cc": 1329 } },
    ];
    expect(specKosongDiVarianLain(variants, 1)).toEqual(["fitur.keyless"]);
    expect(specKosongDiVarianLain(variants, 0)).toEqual([]);
  });

  it("varian tunggal tidak pernah dianggap bolong", () => {
    expect(specKosongDiVarianLain([{ specs: { "fitur.keyless": true } }], 0)).toEqual([]);
  });

  it("menghitung model yang belum dipublikasikan", () => {
    expect(
      jumlahBelumTerbit([{ isPublished: false }, { isPublished: true }, { isPublished: false }]),
    ).toBe(2);
  });
});

describe("varian baru", () => {
  it("menyiapkan baris harga untuk seluruh kota tenant, bukan kota katalog", () => {
    const v = varianBaru("Tipe dasar", 0, KOTA);
    expect(v.priceOtr.map((p) => p.cityCode)).toEqual(["JKT", "BDG"]);
    expect(v.priceSource).toBe("manual");
    expect(v.priceEstimated).toBe(false);
  });
});
