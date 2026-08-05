/**
 * Mock modul Vehicle Models — kendaraan BARU (kontrak §7.1).
 *
 * Modul ini memegang **satu-satunya** penyimpanan model per tenant. Model hasil
 * seed katalog (`catalog-store.ts`) dan model buatan tangan tinggal di tempat
 * yang sama — kalau dipisah, daftar unit tenant akan pecah jadi dua dan
 * provenance-nya mustahil dirunut.
 *
 * Kuota plan dihitung **per model**, bukan per varian: satu model dengan 4
 * varian = 1 item (kontrak §7.1).
 *
 * Bebas dependensi Nitro/h3 → bisa diuji unit murni.
 */
import { registerStore } from "./persist";
import {
  hargaMulaiDari,
  vehicleModelInputSchema,
  vehicleModelQuerySchema,
  vehicleModelUpdateSchema,
  type VehicleModel,
  type VehicleVariant,
} from "@marketplaceindo/shared";
import { TenantApiError } from "./api-error";
import { normalizeSubdomain } from "../../shared/utils/subdomain";

interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

/** Penyimpanan tunggal model kendaraan baru per tenant. */
const modelsByTenant = new Map<string, VehicleModel[]>();
/** Indeks modelId → tenantId (kontrak §7.1 memakai /vehicle-models/:id). */
const modelOwner = new Map<string, string>();

/** Batas item per plan dasar (kontrak §7.1 PLAN_LIMIT_REACHED). */
const MAX_MODELS = 50;

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function slugify(value: string): string {
  return normalizeSubdomain(value) || "model";
}

function uniqueSlug(existing: VehicleModel[], base: string, skipId?: string): string {
  const taken = new Set(existing.filter((m) => m.id !== skipId).map((m) => m.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 500; i += 1) {
    if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Akses penyimpanan (dipakai catalog-store agar seed & CRUD satu tempat)
// ---------------------------------------------------------------------------

export function modelsOf(tenantId: string): VehicleModel[] {
  return modelsByTenant.get(tenantId) ?? [];
}

/** Tulis daftar model tenant sekaligus (dipakai jalur seed katalog). */
export function setModels(tenantId: string, models: VehicleModel[]): void {
  modelsByTenant.set(tenantId, models);
  for (const model of models) modelOwner.set(model.id, tenantId);
}

export function resetModels(tenantId: string): void {
  for (const model of modelsOf(tenantId)) modelOwner.delete(model.id);
  modelsByTenant.delete(tenantId);
}

export function tenantIdOfModel(modelId: string): string {
  const tenantId = modelOwner.get(modelId);
  if (!tenantId) throw new TenantApiError(404, "NOT_FOUND", "Model tidak ditemukan");
  return tenantId;
}

function findModel(tenantId: string, modelId: string): VehicleModel {
  const model = modelsOf(tenantId).find((m) => m.id === modelId);
  if (!model) throw new TenantApiError(404, "NOT_FOUND", "Model tidak ditemukan");
  return model;
}

// ---------------------------------------------------------------------------
// CRUD (kontrak §7.1)
// ---------------------------------------------------------------------------

const contains = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.toLowerCase());

/** GET /v1/tenants/:id/vehicle-models */
export function listVehicleModels(tenantId: string, rawQuery: unknown = {}): Paginated<VehicleModel> {
  const query = vehicleModelQuerySchema.parse(rawQuery);
  let items = modelsOf(tenantId);

  if (query.q) items = items.filter((m) => contains(`${m.brand} ${m.name}`, query.q!));
  if (query.brand) items = items.filter((m) => m.brand.toLowerCase() === query.brand!.toLowerCase());
  if (query.body) items = items.filter((m) => m.bodyType === query.body);

  const harga = (m: VehicleModel) => hargaMulaiDari(m.variants, query.city) ?? 0;
  if (query.hargaMin !== undefined) items = items.filter((m) => harga(m) >= query.hargaMin!);
  if (query.hargaMax !== undefined) items = items.filter((m) => harga(m) <= query.hargaMax!);

  items = [...items].sort((a, b) => {
    switch (query.sort) {
      case "harga_asc":
        return harga(a) - harga(b);
      case "harga_desc":
        return harga(b) - harga(a);
      case "terbaru":
        return b.updatedAt.localeCompare(a.updatedAt);
      default:
        return a.order - b.order;
    }
  });

  const offset = query.cursor ? Number.parseInt(query.cursor, 10) || 0 : 0;
  return {
    items: items.slice(offset, offset + query.limit),
    nextCursor: offset + query.limit < items.length ? String(offset + query.limit) : null,
  };
}

/** Beri id pada varian yang belum punya (input hanya membawa bentuk varian). */
function materializeVariants(raw: VehicleModel["variants"]): VehicleVariant[] {
  return raw.map((variant) => ({
    ...variant,
    id: variant.id || crypto.randomUUID(),
  }));
}

/** POST /v1/tenants/:id/vehicle-models */
export function createVehicleModel(tenantId: string, raw: unknown): VehicleModel {
  // Schema memvalidasi lintas-field bodyType×vertical dan specs×vertical (§7.1/§7.3).
  const input = vehicleModelInputSchema.parse(raw);
  const list = modelsOf(tenantId);
  if (list.length >= MAX_MODELS) {
    throw new TenantApiError(409, "PLAN_LIMIT_REACHED", `Maksimal ${MAX_MODELS} model di paket ini`);
  }

  const now = nowIso();
  const model: VehicleModel = {
    ...input,
    id: crypto.randomUUID(),
    slug: uniqueSlug(list, slugify(input.slug || input.name)),
    variants: materializeVariants(input.variants as VehicleModel["variants"]),
    order: input.order ?? list.length,
    createdAt: now,
    updatedAt: now,
  };

  setModels(tenantId, [...list, model]);
  return model;
}

/** PATCH /v1/vehicle-models/:modelId */
export function updateVehicleModel(tenantId: string, modelId: string, raw: unknown): VehicleModel {
  const patch = vehicleModelUpdateSchema.parse(raw);
  const list = modelsOf(tenantId);
  const model = findModel(tenantId, modelId);

  Object.assign(model, patch);
  if (patch.slug) model.slug = uniqueSlug(list, slugify(patch.slug), modelId);
  if (patch.variants) {
    model.variants = materializeVariants(patch.variants as VehicleModel["variants"]);
  }
  model.updatedAt = nowIso();
  return model;
}

/** DELETE /v1/vehicle-models/:modelId */
export function deleteVehicleModel(tenantId: string, modelId: string): void {
  const list = modelsOf(tenantId);
  if (!list.some((m) => m.id === modelId)) {
    throw new TenantApiError(404, "NOT_FOUND", "Model tidak ditemukan");
  }
  modelsByTenant.set(
    tenantId,
    list.filter((m) => m.id !== modelId),
  );
  modelOwner.delete(modelId);
}

// --- Persistensi dev (lihat persist.ts) ------------------------------------
registerStore("vehicleModels", {
  dump: () => ({ models: [...modelsByTenant.entries()], owner: [...modelOwner.entries()] }),
  restore: (d: { models: [string, VehicleModel[]][]; owner: [string, string][] }) => {
    modelsByTenant.clear();
    for (const [k, v] of d.models) modelsByTenant.set(k, v);
    modelOwner.clear();
    for (const [k, v] of d.owner) modelOwner.set(k, v);
  },
});
