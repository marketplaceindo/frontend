/**
 * Katalog seed kendaraan baru (§4 addendum) — mock store yang menyokong wizard.
 *
 * Yang diuji di sini adalah janji-janji yang kalau pecah akan sampai ke sales:
 * jalur fallback D-14 ditandai, seed selalu `isPublished: false`, dan round-trip
 * harga mencocokkan by ID sehingga rename varian tidak merusak apa pun.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { vehicleModelSchema, POPULAR_RANK_MAX } from "@marketplaceindo/shared";
import {
  catalogBrands,
  catalogCities,
  catalogModels,
  listSeededModels,
  resetCatalogSeed,
  seedInventory,
} from "../server/mock/catalog-store";
import { exportPrices, importPrices } from "../server/mock/inventory-price-store";

const TENANT = "tenant-uji-katalog";
const TENANT_LAIN = "tenant-lain";

function toyota() {
  const brand = catalogBrands("mobil").brands.find((b) => b.slug === "toyota");
  if (!brand) throw new Error("fixture Toyota tidak ada");
  return brand;
}

/** Model termurah Toyota di kota tertentu — diturunkan, bukan di-hardcode. */
function modelToyota(slug: string, cityCode = "JKT") {
  const m = catalogModels(toyota().id, cityCode).models.find((x) => x.slug === slug);
  if (!m) throw new Error(`model ${slug} tidak ada di katalog`);
  return m;
}

/**
 * Harga varian termurah model, dipakai menyusun berkas Excel uji. Katalog kini
 * disalin dari YAML backend (scripts/sync-catalog.mjs), jadi angkanya berubah
 * setiap pricelist diperbarui — test tidak boleh menuliskannya ulang.
 */
function hargaTermurah(slug: string): number {
  const harga = modelToyota(slug).priceFrom;
  if (harga === null) throw new Error(`model ${slug} tanpa harga`);
  return harga;
}

beforeEach(() => {
  resetCatalogSeed(TENANT);
  resetCatalogSeed(TENANT_LAIN);
});

describe("GET /catalog/brands", () => {
  it("memisahkan merk per vertikal", () => {
    // Katalog mobil disalin dari YAML backend; jumlah merk tumbuh seiring
    // pricelist ditambahkan, jadi yang dijaga adalah pemisahan vertikalnya.
    const mobil = catalogBrands("mobil").brands.map((b) => b.slug);
    expect(mobil).toContain("toyota");
    expect(mobil.length).toBeGreaterThan(1);
    expect(mobil).not.toContain("honda"); // honda hanya ada di vertikal motor
    expect(catalogBrands("motor").brands.map((b) => b.slug)).not.toContain("toyota");
  });

  it("tidak membocorkan field selain id/slug/name", () => {
    for (const brand of catalogBrands("mobil").brands) {
      expect(Object.keys(brand).sort()).toEqual(["id", "name", "slug"]);
    }
  });
});

describe("GET /catalog/cities", () => {
  it("menandai kota tanpa OTR exact — tanpa membuangnya dari daftar", () => {
    const cities = catalogCities("mobil").cities;
    const jkt = cities.find((c) => c.code === "JKT");
    const pwt = cities.find((c) => c.code === "PWT");

    // Katalog nyata baru memuat harga NATIONAL (selisih BBN per provinsi belum
    // diverifikasi), jadi BELUM ada kota ber-OTR exact. Yang dijaga: kota tanpa
    // harga exact tetap muncul di daftar, tidak dibuang diam-diam.
    expect(jkt).toBeDefined();
    expect(pwt).toBeDefined();
    expect(pwt?.hasExactPrice).toBe(false);
  });
});

describe("GET /catalog/models", () => {
  it("katalog NATIONAL-only → setiap kota ditandai estimasi (D-14)", () => {
    // Selama pricelist per kota belum diverifikasi, SETIAP harga yang sampai ke
    // tenant adalah hasil fallback. Menandainya adalah inti D-14: sales harus
    // tahu angka itu bukan OTR kotanya.
    for (const kota of ["JKT", "PWT", "MDN"]) {
      const avanza = modelToyota("avanza", kota);
      expect(avanza.priceFrom).not.toBeNull();
      expect(avanza.priceEstimated, `${kota} seharusnya estimasi`).toBe(true);
      expect(avanza.priceEstimatedFromCity).toBe("Nasional");
    }
  });

  it("harga sama di semua kota selama hanya ada harga nasional", () => {
    const kota = ["JKT", "PWT", "MDN"].map((c) => modelToyota("avanza", c).priceFrom);
    expect(new Set(kota).size).toBe(1);
  });

  it("urut popularitas, dan model tidak populer ada di luar ambang pre-check", () => {
    const models = catalogModels(toyota().id, "JKT").models;
    // Terurut menaik menurut popularityRank.
    const rank = models.map((m) => m.popularityRank);
    expect([...rank].sort((a, b) => a - b)).toEqual(rank);
    // Katalog nyata memuat model di luar ambang pre-check wizard.
    expect(models.some((m) => m.popularityRank > POPULAR_RANK_MAX)).toBe(true);
  });

  it("menolak kota di luar katalog", () => {
    expect(() => catalogModels(toyota().id, "XXX")).toThrow();
  });
});

describe("POST /seed-inventory", () => {
  function seedAvanza(cityCode = "JKT") {
    const brand = toyota();
    const avanza = catalogModels(brand.id, cityCode).models.find((m) => m.slug === "avanza")!;
    return seedInventory(TENANT, {
      vertical: "mobil",
      brandId: brand.id,
      cityCode,
      modelIds: [avanza.id],
    });
  }

  it("membuat model + varian, dan hasilnya lolos vehicleModelSchema", () => {
    const hasil = seedAvanza();
    expect(hasil.createdModels).toBe(1);
    // Jumlah varian mengikuti katalog backend, bukan angka tetap.
    expect(hasil.createdVariants).toBe(modelToyota("avanza").variantCount);
    for (const model of listSeededModels(TENANT)) {
      expect(() => vehicleModelSchema.parse(model)).not.toThrow();
    }
  });

  it("isPublished SELALU false — publikasi adalah tindakan sadar tenant", () => {
    seedAvanza();
    for (const model of listSeededModels(TENANT)) {
      expect(model.isPublished).toBe(false);
    }
  });

  it("provenance terisi: catalogModelId, priceSource, priceUpdatedAt", () => {
    seedAvanza();
    const model = listSeededModels(TENANT)[0]!;
    expect(model.catalogModelId).toBeTruthy();
    for (const v of model.variants) {
      expect(v.priceSource).toBe("catalog");
      expect(v.catalogVariantId).toBeTruthy();
      expect(v.priceUpdatedAt).toBeTruthy();
    }
  });

  it("kota fallback → warning price_estimated + harga memakai kota yang DIMINTA", () => {
    const hasil = seedAvanza("PWT");
    // Katalog nyata hanya berharga NATIONAL, jadi rantai D-14 berhenti di
    // "Nasional" — yang penting: fallback-nya DITANDAI, dan baris harganya
    // tetap memakai kota yang diminta user (bukan kota asal harga).
    expect(hasil.warnings).toContainEqual({
      kind: "price_estimated",
      modelSlug: "avanza",
      fromCity: "Nasional",
    });
    const varian = listSeededModels(TENANT)[0]!.variants[0]!;
    expect(varian.priceEstimated).toBe(true);
    expect(varian.priceEstimatedFromCity).toBe("Nasional");
    expect(varian.priceOtr[0]!.cityCode).toBe("PWT");
    expect(varian.priceOtr[0]!.cityName).toBe("Purwokerto");
  });

  it("idempoten — seed dua kali tidak menduplikasi", () => {
    seedAvanza();
    const kedua = seedAvanza();
    expect(kedua.createdModels).toBe(0);
    expect(listSeededModels(TENANT)).toHaveLength(1);
    expect(kedua.skipped[0]?.reason).toBe("sudah pernah di-seed dari katalog");
  });

  it("menolak merk yang vertikalnya tidak cocok", () => {
    expect(() =>
      seedInventory(TENANT, {
        vertical: "motor",
        brandId: toyota().id,
        cityCode: "JKT",
        modelIds: ["11111111-1111-4111-8111-111111111111"],
      }),
    ).toThrow();
  });

  it("vertikal motor memakai bentuk yang sama persis", () => {
    const honda = catalogBrands("motor").brands[0]!;
    const vario = catalogModels(honda.id, "JKT").models[0]!;
    const hasil = seedInventory(TENANT, {
      vertical: "motor",
      brandId: honda.id,
      cityCode: "JKT",
      modelIds: [vario.id],
    });

    expect(hasil.createdVariants).toBe(2);
    const model = listSeededModels(TENANT)[0]!;
    expect(model.vertical).toBe("motor");
    expect(model.bodyType).toBe("matic");
    expect(() => vehicleModelSchema.parse(model)).not.toThrow();
  });
});

describe("round-trip harga (D-16)", () => {
  function siapkan() {
    const brand = toyota();
    const avanza = modelToyota("avanza");
    seedInventory(TENANT, {
      vertical: "mobil",
      brandId: brand.id,
      cityCode: "JKT",
      modelIds: [avanza.id],
    });
    return exportPrices(TENANT);
  }

  it("export memuat header, catatan, lalu satu baris per (varian, kota)", () => {
    const baris = siapkan().trim().split("\n");
    expect(baris[0]).toContain("ID Varian");
    expect(baris[1]).toContain("Ubah hanya kolom Harga");
    expect(baris.length).toBeGreaterThanOrEqual(3); // header + catatan + ≥1 varian
  });

  it("mengubah harga → updated, priceSource excel, estimasi dimatikan", () => {
    const file = siapkan();
    const diubah = file.replace(String(hargaTermurah("avanza")), "Rp 245.000.000");

    const hasil = importPrices(TENANT, diubah);
    expect(hasil.updated).toBe(1);

    const varian = listSeededModels(TENANT)[0]!.variants.find(
      (v) => v.priceOtr[0]!.price === 245_000_000,
    );
    expect(varian?.priceSource).toBe("excel");
    expect(varian?.priceEstimated).toBe(false);
  });

  it("harga sama → no_change, bukan update", () => {
    const file = siapkan();
    const hasil = importPrices(TENANT, file);
    expect(hasil.updated).toBe(0);
    expect(hasil.warnings.every((w) => w.kind === "no_change")).toBe(true);
  });

  it("nama varian di-rename → name_mismatch sebagai warning, harga tetap masuk", () => {
    const file = siapkan();
    // Ambil nama varian dari berkas ekspor itu sendiri, lalu ubah namanya —
    // pencocokan tetap by ID, jadi harganya harus tetap masuk.
    const namaVarian = listSeededModels(TENANT)[0]!.variants[0]!.name;
    const diubah = file
      .replace(namaVarian, `${namaVarian} (rename)`)
      .replace(String(hargaTermurah("avanza")), "245000000");

    const hasil = importPrices(TENANT, diubah);
    expect(hasil.updated).toBe(1);
    expect(hasil.warnings.some((w) => w.kind === "name_mismatch")).toBe(true);
  });

  it("harga tak terbaca → price_invalid, baris dilewati", () => {
    const file = siapkan();
    const hasil = importPrices(TENANT, file.replace(String(hargaTermurah("avanza")), "hubungi sales"));
    expect(hasil.updated).toBe(0);
    expect(hasil.warnings.some((w) => w.kind === "price_invalid")).toBe(true);
  });

  it("file milik tenant lain → semua variant_not_found, nol perubahan", () => {
    const file = siapkan();
    const hasil = importPrices(TENANT_LAIN, file.replace(String(hargaTermurah("avanza")), "245000000"));

    expect(hasil.updated).toBe(0);
    expect(hasil.warnings.every((w) => w.kind === "variant_not_found")).toBe(true);
    // Pesan tidak boleh menyiratkan varian itu ada di tempat lain.
    for (const w of hasil.warnings) expect(w.message).not.toMatch(/tenant lain/i);
  });

  it("menolak file kosong", () => {
    expect(() => importPrices(TENANT, "   ")).toThrow();
  });
});
