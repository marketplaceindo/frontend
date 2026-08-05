/**
 * Fase 7c butir 4 — lapisan data model kendaraan baru (kontrak §7.1).
 *
 * Yang paling penting diuji di sini: model hasil seed katalog dan model buatan
 * tangan tinggal di SATU penyimpanan. Kalau pecah dua, daftar unit tenant akan
 * menampilkan sebagian saja dan provenance-nya mustahil dirunut.
 */
import { describe, expect, it } from "vitest";
import { TenantApiError } from "../server/mock/api-error";
import {
  createVehicleModel,
  deleteVehicleModel,
  listVehicleModels,
  resetModels,
  tenantIdOfModel,
  updateVehicleModel,
} from "../server/mock/vehicle-model-store";
import {
  catalogBrands,
  catalogModels,
  listSeededModels,
  resetCatalogSeed,
  seedInventory,
} from "../server/mock/catalog-store";

const TENANT = "11111111-1111-4111-8111-111111111111";

/** ID merk diturunkan dari katalog — sejak katalog disalin dari YAML backend,
 *  id-nya hash dari slug dan tidak boleh ditulis ulang di test. */
function brandToyota(): string {
  const b = catalogBrands("mobil").brands.find((x) => x.slug === "toyota");
  if (!b) throw new Error("merk toyota tidak ada di katalog");
  return b.id;
}

function modelBaru(over: Record<string, unknown> = {}) {
  return {
    vertical: "mobil",
    brand: "Mitsubishi",
    name: "Xpander",
    modelYear: 2026,
    bodyType: "mpv",
    images: [{ url: "https://cdn.test/xpander.jpg", alt: "Xpander" }],
    summary: "MPV keluarga dengan ground clearance tinggi.",
    variants: [
      {
        name: "Ultimate CVT",
        trimRank: 2,
        priceOtr: [{ cityCode: "JKT", cityName: "Jakarta", price: 318_000_000 }],
      },
    ],
    ...over,
  };
}

function bersih(tenantId: string) {
  resetModels(tenantId);
}

describe("CRUD model kendaraan baru", () => {
  it("create → list → update → delete", () => {
    const t = `${TENANT}-a`;
    bersih(t);

    const model = createVehicleModel(t, modelBaru());
    expect(model.slug).toBe("xpander");
    expect(model.variants[0]!.id).toBeTruthy();
    expect(listVehicleModels(t).items).toHaveLength(1);

    const ubah = updateVehicleModel(t, model.id, { isPublished: true });
    expect(ubah.isPublished).toBe(true);

    deleteVehicleModel(t, model.id);
    expect(listVehicleModels(t).items).toHaveLength(0);
  });

  it("slug bentrok diberi sufiks, bukan menimpa", () => {
    const t = `${TENANT}-b`;
    bersih(t);
    createVehicleModel(t, modelBaru());
    const kedua = createVehicleModel(t, modelBaru());
    expect(kedua.slug).toBe("xpander-2");
  });

  it("bodyType di luar vertikal ditolak schema (§7.1 lintas-field)", () => {
    const t = `${TENANT}-c`;
    bersih(t);
    // `matic` hanya sah untuk motor.
    expect(() => createVehicleModel(t, modelBaru({ bodyType: "matic" }))).toThrow();
  });

  it("spec di luar vertikal ditolak (kaki.tipe_rangka pada mobil)", () => {
    const t = `${TENANT}-d`;
    bersih(t);
    expect(() =>
      createVehicleModel(
        t,
        modelBaru({
          variants: [
            {
              name: "Ultimate",
              trimRank: 0,
              priceOtr: [{ cityCode: "JKT", cityName: "Jakarta", price: 1 }],
              specs: { "kaki.tipe_rangka": "deltabox" },
            },
          ],
        }),
      ),
    ).toThrow();
  });

  it("model tak dikenal → 404 NOT_FOUND", () => {
    const t = `${TENANT}-e`;
    bersih(t);
    try {
      updateVehicleModel(t, "tidak-ada", { isPublished: true });
      expect.unreachable("harus melempar NOT_FOUND");
    } catch (err) {
      expect(err).toBeInstanceOf(TenantApiError);
      expect((err as TenantApiError).status).toBe(404);
    }
  });

  it("indeks modelId → tenantId menopang route /vehicle-models/:id", () => {
    const t = `${TENANT}-f`;
    bersih(t);
    const model = createVehicleModel(t, modelBaru());
    expect(tenantIdOfModel(model.id)).toBe(t);
  });
});

describe("filter & urutan daftar", () => {
  it("menyaring q/brand/body dan mengurutkan harga", () => {
    const t = `${TENANT}-g`;
    bersih(t);
    createVehicleModel(t, modelBaru({ name: "Xpander", order: 1 }));
    createVehicleModel(
      t,
      modelBaru({
        brand: "Honda",
        name: "Brio",
        bodyType: "hatchback",
        order: 0,
        variants: [
          {
            name: "RS CVT",
            trimRank: 0,
            priceOtr: [{ cityCode: "JKT", cityName: "Jakarta", price: 212_000_000 }],
          },
        ],
      }),
    );

    expect(listVehicleModels(t, { q: "brio" }).items).toHaveLength(1);
    expect(listVehicleModels(t, { brand: "honda" }).items).toHaveLength(1);
    expect(listVehicleModels(t, { body: "hatchback" }).items).toHaveLength(1);

    const murahDulu = listVehicleModels(t, { sort: "harga_asc", city: "JKT" }).items;
    expect(murahDulu[0]!.name).toBe("Brio");
  });
});

describe("satu penyimpanan untuk seed katalog dan model manual", () => {
  it("model hasil seed terlihat lewat listVehicleModels, bukan daftar terpisah", () => {
    const t = `${TENANT}-h`;
    resetCatalogSeed(t);

    const katalog = catalogModels(brandToyota(), "JKT").models;
    const hasil = seedInventory(t, {
      vertical: "mobil",
      brandId: brandToyota(),
      cityCode: "JKT",
      modelIds: [katalog[0]!.id],
    });
    expect(hasil.createdModels).toBe(1);

    const manual = createVehicleModel(t, modelBaru());

    // Inilah invariant-nya: satu daftar memuat KEDUA asal.
    const daftar = listVehicleModels(t).items;
    expect(daftar).toHaveLength(2);
    expect(daftar.map((m) => m.id)).toContain(manual.id);
    expect(daftar.some((m) => m.catalogModelId)).toBe(true);

    // `listSeededModels()` tetap ter-ekspor dengan tanda tangan yang sama
    // (dipakai tests/catalog-seed.spec.ts dan inventory-price-store).
    expect(listSeededModels(t)).toHaveLength(2);
  });

  it("varian hasil seed membawa provenance katalog, varian manual tidak", () => {
    const t = `${TENANT}-j`;
    resetCatalogSeed(t);

    const katalog = catalogModels(brandToyota(), "JKT").models;
    seedInventory(t, {
      vertical: "mobil",
      brandId: brandToyota(),
      cityCode: "JKT",
      modelIds: [katalog[0]!.id],
    });
    const manual = createVehicleModel(t, modelBaru());

    const dariKatalog = listVehicleModels(t).items.find((m) => m.catalogModelId)!;
    expect(dariKatalog.variants[0]!.priceSource).toBe("catalog");
    expect(dariKatalog.variants[0]!.catalogVariantId).toBeTruthy();
    expect(manual.variants[0]!.catalogVariantId).toBeUndefined();
  });

  it("model manual juga ikut terhapus saat katalog di-reset", () => {
    const t = `${TENANT}-i`;
    resetCatalogSeed(t);
    createVehicleModel(t, modelBaru());
    expect(listVehicleModels(t).items).toHaveLength(1);

    resetCatalogSeed(t);
    expect(listVehicleModels(t).items).toHaveLength(0);
  });
});
