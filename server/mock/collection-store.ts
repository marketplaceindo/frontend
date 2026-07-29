/**
 * Mock modul Collections — Vehicles & Products (Fase 7c; kontrak §7).
 * Menyimpan koleksi per tenant untuk sisi editor; render publik membacanya
 * lewat `render-store` (fixture seed) atau — untuk tenant dashboard — lewat
 * fungsi di sini.
 *
 * Slug unik per tenant, auto-generate dari nama bila tidak diisi.
 *
 * Bebas dependensi Nitro/h3 → bisa diuji unit murni.
 */
import {
  productInputSchema,
  productQuerySchema,
  productUpdateSchema,
  vehicleUnitInputSchema,
  vehicleUnitQuerySchema,
  vehicleUnitUpdateSchema,
  type Product,
  type VehicleUnit,
} from "@marketplaceindo/shared";
import { TenantApiError } from "./api-error";
import { normalizeSubdomain } from "../../shared/utils/subdomain";

interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

const vehicles = new Map<string, VehicleUnit[]>();
const products = new Map<string, Product[]>();
/** Indeks itemId → tenantId (kontrak §7 memakai /vehicles/:id tanpa tenant). */
const itemOwner = new Map<string, string>();

/** Batas item per plan dasar (kontrak §7 PLAN_LIMIT_REACHED). */
const MAX_ITEMS = 50;

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function slugify(name: string): string {
  return normalizeSubdomain(name) || "item";
}

/** Slug unik per tenant: tambahkan sufiks angka bila bentrok. */
function uniqueSlug(existing: { slug: string }[], base: string, skipId?: string): string {
  const taken = new Set(existing.filter((e) => (e as { id?: string }).id !== skipId).map((e) => e.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 500; i++) {
    if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

function paginate<T>(items: T[], limit: number, cursor?: string): Paginated<T> {
  const offset = cursor ? Number.parseInt(cursor, 10) || 0 : 0;
  return {
    items: items.slice(offset, offset + limit),
    nextCursor: offset + limit < items.length ? String(offset + limit) : null,
  };
}

const contains = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.toLowerCase());

export function tenantIdOfItem(itemId: string): string {
  const tenantId = itemOwner.get(itemId);
  if (!tenantId) throw new TenantApiError(404, "NOT_FOUND", "Item tidak ditemukan");
  return tenantId;
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export function listVehicles(tenantId: string, rawQuery: unknown = {}): Paginated<VehicleUnit> {
  const query = vehicleUnitQuerySchema.parse(rawQuery);
  let items = vehicles.get(tenantId) ?? [];
  if (query.q) items = items.filter((v) => contains(`${v.name} ${v.brand} ${v.model ?? ""}`, query.q!));
  if (query.brand) items = items.filter((v) => v.brand.toLowerCase() === query.brand!.toLowerCase());
  if (query.priceMin !== undefined) items = items.filter((v) => v.price >= query.priceMin!);
  if (query.priceMax !== undefined) items = items.filter((v) => v.price <= query.priceMax!);
  if (query.year !== undefined) items = items.filter((v) => v.year === query.year);
  if (query.transmission) items = items.filter((v) => v.transmission === query.transmission);
  items = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(items, query.limit, query.cursor);
}

export function createVehicle(tenantId: string, raw: unknown): VehicleUnit {
  const input = vehicleUnitInputSchema.parse(raw);
  const list = vehicles.get(tenantId) ?? [];
  if (list.length >= MAX_ITEMS) {
    throw new TenantApiError(409, "PLAN_LIMIT_REACHED", `Maksimal ${MAX_ITEMS} unit di paket ini`);
  }
  const id = crypto.randomUUID();
  const now = nowIso();
  const vehicle: VehicleUnit = {
    ...input,
    id,
    slug: uniqueSlug(list, input.slug ? slugify(input.slug) : slugify(input.name)),
    createdAt: now,
    updatedAt: now,
  };
  list.push(vehicle);
  vehicles.set(tenantId, list);
  itemOwner.set(id, tenantId);
  return vehicle;
}

export function updateVehicle(tenantId: string, vehicleId: string, raw: unknown): VehicleUnit {
  const patch = vehicleUnitUpdateSchema.parse(raw);
  const list = vehicles.get(tenantId) ?? [];
  const vehicle = list.find((v) => v.id === vehicleId);
  if (!vehicle) throw new TenantApiError(404, "NOT_FOUND", "Unit tidak ditemukan");

  Object.assign(vehicle, patch);
  if (patch.slug) vehicle.slug = uniqueSlug(list, slugify(patch.slug), vehicleId);
  vehicle.updatedAt = nowIso();
  return vehicle;
}

export function deleteVehicle(tenantId: string, vehicleId: string): void {
  const list = vehicles.get(tenantId) ?? [];
  if (!list.some((v) => v.id === vehicleId)) {
    throw new TenantApiError(404, "NOT_FOUND", "Unit tidak ditemukan");
  }
  vehicles.set(tenantId, list.filter((v) => v.id !== vehicleId));
  itemOwner.delete(vehicleId);
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export function listProducts(tenantId: string, rawQuery: unknown = {}): Paginated<Product> {
  const query = productQuerySchema.parse(rawQuery);
  let items = products.get(tenantId) ?? [];
  if (query.q) items = items.filter((p) => contains(`${p.name} ${p.category ?? ""}`, query.q!));
  if (query.category)
    items = items.filter((p) => (p.category ?? "").toLowerCase() === query.category!.toLowerCase());
  if (query.priceMin !== undefined) items = items.filter((p) => p.price >= query.priceMin!);
  if (query.priceMax !== undefined) items = items.filter((p) => p.price <= query.priceMax!);
  items = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(items, query.limit, query.cursor);
}

export function createProduct(tenantId: string, raw: unknown): Product {
  const input = productInputSchema.parse(raw);
  const list = products.get(tenantId) ?? [];
  if (list.length >= MAX_ITEMS) {
    throw new TenantApiError(409, "PLAN_LIMIT_REACHED", `Maksimal ${MAX_ITEMS} produk di paket ini`);
  }
  const id = crypto.randomUUID();
  const now = nowIso();
  const product: Product = {
    ...input,
    id,
    slug: uniqueSlug(list, input.slug ? slugify(input.slug) : slugify(input.name)),
    createdAt: now,
    updatedAt: now,
  };
  list.push(product);
  products.set(tenantId, list);
  itemOwner.set(id, tenantId);
  return product;
}

export function updateProduct(tenantId: string, productId: string, raw: unknown): Product {
  const patch = productUpdateSchema.parse(raw);
  const list = products.get(tenantId) ?? [];
  const product = list.find((p) => p.id === productId);
  if (!product) throw new TenantApiError(404, "NOT_FOUND", "Produk tidak ditemukan");

  Object.assign(product, patch);
  if (patch.slug) product.slug = uniqueSlug(list, slugify(patch.slug), productId);
  product.updatedAt = nowIso();
  return product;
}

export function deleteProduct(tenantId: string, productId: string): void {
  const list = products.get(tenantId) ?? [];
  if (!list.some((p) => p.id === productId)) {
    throw new TenantApiError(404, "NOT_FOUND", "Produk tidak ditemukan");
  }
  products.set(tenantId, list.filter((p) => p.id !== productId));
  itemOwner.delete(productId);
}

/** Koleksi tenant untuk disusun ke dalam fixture render (block grid & VDP/PDP). */
export function collectionsOf(tenantId: string): { vehicles: VehicleUnit[]; products: Product[] } {
  return { vehicles: vehicles.get(tenantId) ?? [], products: products.get(tenantId) ?? [] };
}
