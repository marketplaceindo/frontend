/**
 * Katalog seed kendaraan baru — mock in-memory (kontrak §7.4–§7.6).
 *
 * Data di sini adalah **fixture pengembangan**, bukan pricelist. Angka harganya
 * cukup untuk menguji rantai fallback D-14 (Purwokerto → Semarang → NATIONAL)
 * dan tidak pernah dipakai di produksi: di produksi katalog berasal dari YAML
 * di repo backend (D-15) yang menolak angka karangan saat import.
 *
 * Materialisasi memakai fungsi murni `seedFromCatalog()` dari shared — bukan
 * salinan logika. Itu yang membuat preview di mock dan hasil di backend
 * mustahil divergen.
 */
import {
  MAX_SEED_MODELS,
  MAX_SEED_VARIANTS,
  NATIONAL_CITY_CODE,
  buildCityChain,
  resolvePriceForCity,
  seedFromCatalog,
  seedInventoryRequestSchema,
  type CatalogBrandsResponse,
  type CatalogCitiesResponse,
  type CatalogCity,
  type CatalogModelCard,
  type CatalogModelsResponse,
  type CatalogPrice,
  type CatalogVehicleModel,
  type SeedInventoryResult,
  type SeedWarning,
  type VehicleModel,
  type VehicleVertical,
} from "@marketplaceindo/shared";
import { TenantApiError } from "./api-error";
import { modelsOf, resetModels, setModels } from "./vehicle-model-store";

// ---------------------------------------------------------------------------
// Kota (batch pertama §6 addendum: 5 ibukota + 2 kota fallback)
// ---------------------------------------------------------------------------

const CITIES: CatalogCity[] = [
  { code: "JKT", name: "Jakarta", provinceCode: "DKI", isProvinceCapital: true },
  { code: "BDG", name: "Bandung", provinceCode: "JABAR", isProvinceCapital: true },
  { code: "BGR", name: "Bogor", provinceCode: "JABAR", isProvinceCapital: false },
  { code: "SBY", name: "Surabaya", provinceCode: "JATIM", isProvinceCapital: true },
  { code: "SMG", name: "Semarang", provinceCode: "JATENG", isProvinceCapital: true },
  { code: "PWT", name: "Purwokerto", provinceCode: "JATENG", isProvinceCapital: false },
  { code: "MDN", name: "Medan", provinceCode: "SUMUT", isProvinceCapital: true },
];

const CAPITALS: Record<string, string> = Object.fromEntries(
  CITIES.filter((c) => c.isProvinceCapital).map((c) => [c.provinceCode, c.code]),
);
const CITY_NAMES: Record<string, string> = Object.fromEntries(CITIES.map((c) => [c.code, c.name]));

// ---------------------------------------------------------------------------
// Merk & model
// ---------------------------------------------------------------------------

/*
 * Merk & model datang dari `fixtures/catalog.json` — hasil `scripts/sync-catalog.mjs`
 * yang menyalin YAML katalog di repo backend. Sebelumnya daftar ini ditulis
 * tangan dan hanya memuat satu merk, sehingga merk yang ditambahkan di backend
 * tidak pernah muncul di wizard.
 */
import katalogFixture from "./fixtures/catalog.json";

interface MockBrand {
  id: string;
  vertical: VehicleVertical;
  slug: string;
  name: string;
  order: number;
}

interface MockModel extends CatalogVehicleModel {
  /** Harga per varian; `NATIONAL` selalu ada — invariant #1 import backend. */
  prices: CatalogPrice[];
}

/*
 * Cadangan vertikal motor. Repo backend belum punya `catalog/motor/`, sehingga
 * hasil sync tidak memuat merk motor sama sekali. Tanpa cadangan ini seluruh
 * jalur motor (wizard, spec per vertikal, seed) jadi mustahil dicoba di dev.
 * Begitu katalog motor sungguhan ada, blok ini otomatis tidak terpakai.
 */
const MOTOR_CADANGAN_BRAND: MockBrand = {
  id: "b1000000-0000-4000-8000-000000000002",
  vertical: "motor",
  slug: "honda",
  name: "Honda",
  order: 1,
};

const MOTOR_CADANGAN_MODEL = {
  id: "c0000000-0000-4000-8000-000000000101",
  brandId: MOTOR_CADANGAN_BRAND.id,
  vertical: "motor" as const,
  slug: "vario-160",
  name: "Vario 160",
  modelYear: 2026,
  bodyType: "matic",
  images: [
    {
      url: "https://cdn.marketindonesia.co.id/catalog/vario-160/01.jpg",
      alt: "Honda Vario 160 2026 tampak depan",
    },
  ],
  summary: "Skutik 160cc untuk harian.",
  popularityRank: 0,
  variants: [
    {
      id: "c0000000-0000-4000-8000-000000000102",
      modelId: "c0000000-0000-4000-8000-000000000101",
      slug: "cbs",
      name: "CBS",
      trimRank: 0,
      specs: { "mesin.kapasitas_cc": 157, "keselamatan.pengereman": "cbs" },
      colors: [],
      highlights: [],
    },
    {
      id: "c0000000-0000-4000-8000-000000000103",
      modelId: "c0000000-0000-4000-8000-000000000101",
      slug: "abs",
      name: "ABS",
      trimRank: 1,
      specs: { "mesin.kapasitas_cc": 157, "keselamatan.pengereman": "abs" },
      colors: [],
      highlights: [],
    },
  ],
  prices: [
    { variantId: "c0000000-0000-4000-8000-000000000102", cityCode: NATIONAL_CITY_CODE, price: 27_000_000, effectiveFrom: "2026-07-01", source: "fixture-dev-frontend" },
    { variantId: "c0000000-0000-4000-8000-000000000102", cityCode: "JKT", price: 29_000_000, effectiveFrom: "2026-07-01", source: "fixture-dev-frontend" },
    { variantId: "c0000000-0000-4000-8000-000000000102", cityCode: "SMG", price: 28_000_000, effectiveFrom: "2026-07-01", source: "fixture-dev-frontend" },
    { variantId: "c0000000-0000-4000-8000-000000000103", cityCode: NATIONAL_CITY_CODE, price: 30_000_000, effectiveFrom: "2026-07-01", source: "fixture-dev-frontend" },
    { variantId: "c0000000-0000-4000-8000-000000000103", cityCode: "JKT", price: 32_000_000, effectiveFrom: "2026-07-01", source: "fixture-dev-frontend" },
  ],
} as unknown as MockModel;

const sinkronBrands = katalogFixture.brands as MockBrand[];
const sinkronModels = katalogFixture.models as unknown as MockModel[];
const adaMotor = sinkronBrands.some((b) => b.vertical === "motor");

const BRANDS: MockBrand[] = adaMotor ? sinkronBrands : [...sinkronBrands, MOTOR_CADANGAN_BRAND];
const MODELS: MockModel[] = adaMotor ? sinkronModels : [...sinkronModels, MOTOR_CADANGAN_MODEL];

// ---------------------------------------------------------------------------
// Model tenant hasil seed (mock penyimpanan)
// ---------------------------------------------------------------------------

/*
 * Penyimpanan model tinggal di `vehicle-model-store.ts` — satu tempat untuk
 * model hasil seed DAN model buatan tangan. Kalau dipisah, daftar unit tenant
 * akan pecah jadi dua dan provenance-nya mustahil dirunut.
 */

/** Model kendaraan baru milik tenant — dipakai daftar unit & round-trip harga. */
export function listSeededModels(tenantId: string): VehicleModel[] {
  return modelsOf(tenantId);
}

export function resetCatalogSeed(tenantId: string): void {
  resetModels(tenantId);
}

// ---------------------------------------------------------------------------
// Endpoint katalog
// ---------------------------------------------------------------------------

export function catalogBrands(vertical: VehicleVertical): CatalogBrandsResponse {
  return {
    brands: BRANDS.filter((b) => b.vertical === vertical)
      .sort((a, b) => a.order - b.order)
      .map(({ id, slug, name }) => ({ id, slug, name })),
  };
}

export function catalogCities(vertical: VehicleVertical): CatalogCitiesResponse {
  const berharga = new Set(
    MODELS.filter((m) => m.vertical === vertical).flatMap((m) => m.prices.map((p) => p.cityCode)),
  );
  return {
    cities: CITIES.map((c) => ({
      code: c.code,
      name: c.name,
      provinceCode: c.provinceCode,
      hasExactPrice: berharga.has(c.code),
    })),
  };
}

function kotaAtauTolak(cityCode: string): CatalogCity {
  const kota = CITIES.find((c) => c.code === cityCode);
  if (!kota) {
    throw new TenantApiError(422, "VALIDATION_ERROR", `Kota "${cityCode}" tidak ada di katalog`);
  }
  return kota;
}

export function catalogModels(brandId: string, cityCode: string): CatalogModelsResponse {
  const brand = BRANDS.find((b) => b.id === brandId);
  if (!brand) throw new TenantApiError(404, "NOT_FOUND", "Merk tidak ditemukan di katalog");

  const chain = buildCityChain(kotaAtauTolak(cityCode), CAPITALS);

  const models: CatalogModelCard[] = MODELS.filter((m) => m.brandId === brandId)
    .sort((a, b) => a.popularityRank - b.popularityRank)
    .map((m) => {
      let termurah: { price: number; estimated: boolean; fromCity?: string } | null = null;
      for (const variant of m.variants) {
        const resolved = resolvePriceForCity(
          m.prices.filter((p) => p.variantId === variant.id),
          chain,
          CITY_NAMES,
        );
        if (resolved === null) continue;
        if (termurah === null || resolved.price < termurah.price) {
          termurah = {
            price: resolved.price,
            estimated: resolved.estimated,
            ...(resolved.estimatedFromCity !== undefined
              ? { fromCity: resolved.estimatedFromCity }
              : {}),
          };
        }
      }
      return {
        id: m.id,
        slug: m.slug,
        name: m.name,
        modelYear: m.modelYear,
        bodyType: m.bodyType,
        thumbnailUrl: m.images[0]!.url,
        popularityRank: m.popularityRank,
        variantCount: m.variants.length,
        priceFrom: termurah?.price ?? null,
        priceEstimated: termurah?.estimated ?? false,
        ...(termurah?.fromCity !== undefined ? { priceEstimatedFromCity: termurah.fromCity } : {}),
      };
    });

  return { models };
}

// ---------------------------------------------------------------------------
// Materialize
// ---------------------------------------------------------------------------

export function seedInventory(tenantId: string, raw: unknown): SeedInventoryResult {
  const input = seedInventoryRequestSchema.parse(raw);

  const brand = BRANDS.find((b) => b.id === input.brandId && b.vertical === input.vertical);
  if (!brand) throw new TenantApiError(404, "NOT_FOUND", "Merk tidak ditemukan di katalog");
  if (input.modelIds.length > MAX_SEED_MODELS) {
    throw new TenantApiError(422, "VALIDATION_ERROR", `Maksimal ${MAX_SEED_MODELS} model sekali seed`);
  }

  const kota = kotaAtauTolak(input.cityCode);
  const chain = buildCityChain(kota, CAPITALS);
  const now = new Date().toISOString();

  const tersimpan = modelsOf(tenantId);
  const slugTerpakai = new Set(tersimpan.map((m) => m.slug));
  const catalogVariantTerpakai = new Set(
    tersimpan.flatMap((m) => m.variants.map((v) => v.catalogVariantId)),
  );

  const warnings: SeedWarning[] = [];
  const skipped: SeedInventoryResult["skipped"] = [];
  const baru: VehicleModel[] = [];

  for (const modelId of input.modelIds) {
    const katalog = MODELS.find((m) => m.id === modelId && m.brandId === brand.id);
    if (!katalog) continue;

    const { model, warnings: w } = seedFromCatalog({
      model: katalog,
      brandName: brand.name,
      prices: katalog.prices,
      cityCode: kota.code,
      cityChain: chain,
      cityNames: CITY_NAMES,
      now,
      newId: () => globalThis.crypto.randomUUID(),
      order: tersimpan.length + baru.length,
    });
    warnings.push(...w);

    if (model === null) {
      skipped.push({ modelSlug: katalog.slug, reason: "semua varian tanpa harga" });
      continue;
    }

    // Idempotensi: varian yang sudah pernah di-seed tidak dibuat ulang.
    if (model.variants.every((v) => catalogVariantTerpakai.has(v.catalogVariantId))) {
      skipped.push({ modelSlug: model.slug, reason: "sudah pernah di-seed dari katalog" });
      continue;
    }

    let slug = model.slug;
    for (let i = 2; slugTerpakai.has(slug); i += 1) slug = `${model.slug}-${i}`;
    slugTerpakai.add(slug);
    model.slug = slug;

    for (const v of model.variants) catalogVariantTerpakai.add(v.catalogVariantId);
    baru.push(model);
  }

  const createdVariants = baru.reduce((n, m) => n + m.variants.length, 0);
  if (createdVariants > MAX_SEED_VARIANTS) {
    throw new TenantApiError(
      422,
      "VALIDATION_ERROR",
      `Seed ini menghasilkan ${createdVariants} varian, di atas batas ${MAX_SEED_VARIANTS}.`,
    );
  }

  setModels(tenantId, [...tersimpan, ...baru]);

  return { createdModels: baru.length, createdVariants, skipped, warnings };
}
