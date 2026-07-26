/**
 * Mock render API (Fase 1) — sumber data fixture JSON, divalidasi schema shared
 * saat load. Meniru semantik kontrak §10 (Render API):
 * - subdomain tak dikenal            → 404 TENANT_NOT_FOUND
 * - status draft tanpa preview       → 404 TENANT_NOT_FOUND (situs belum di-publish)
 * - status suspended tanpa preview   → 410 TENANT_SUSPENDED
 * - ?preview=1 → draft/suspended bisa diakses (validasi sesi owner menyusul
 *   di Fase 7a saat auth ada; backend nyata yang menegakkannya).
 * Fase 4 menambah koleksi vehicles/products (filter §7) + lead store (§8).
 *
 * Modul ini sengaja bebas dependensi Nitro/h3 supaya bisa diuji unit murni.
 */
import { z } from "zod";
import {
  createLeadRequestSchema,
  productQuerySchema,
  productSchema,
  renderPageResponseSchema,
  renderTenantResponseSchema,
  vehicleQuerySchema,
  vehicleSchema,
  type CreateLeadRequest,
  type Lead,
  type Product,
  type ProductQuery,
  type RenderPageResponse,
  type RenderSitemapResponse,
  type RenderTenantResponse,
  type Vehicle,
  type VehicleQuery,
} from "@marketplaceindo/shared";
import demo from "./fixtures/demo.json";
import lengkap from "./fixtures/lengkap.json";
import otojaya from "./fixtures/otojaya.json";
import rintisan from "./fixtures/rintisan.json";
import tokoberkah from "./fixtures/tokoberkah.json";
import tutupsementara from "./fixtures/tutupsementara.json";

/** Error setara response error render API; dikonversi ke H3Error di renderClient. */
export class RenderApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RenderApiError";
  }
}

const tenantFixtureSchema = z.object({
  site: renderTenantResponseSchema,
  pages: z.record(z.string(), renderPageResponseSchema),
  vehicles: z.array(vehicleSchema).optional(),
  products: z.array(productSchema).optional(),
});
export type TenantFixture = z.infer<typeof tenantFixtureSchema>;

export const RAW_FIXTURES: Record<string, unknown> = {
  demo,
  lengkap,
  otojaya,
  rintisan,
  tokoberkah,
  tutupsementara,
};

const fixtures = new Map<string, TenantFixture>();
for (const [name, raw] of Object.entries(RAW_FIXTURES)) {
  const parsed = tenantFixtureSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Fixture mock "${name}" tidak lolos schema shared:\n${z.prettifyError(parsed.error)}`,
    );
  }
  if (parsed.data.site.tenant.subdomain !== name) {
    throw new Error(`Fixture mock "${name}": subdomain di dalam fixture harus "${name}"`);
  }
  fixtures.set(name, parsed.data);
}

/**
 * Situs tenant yang dikelola dashboard (wizard Fase 7b + editor Fase 7c),
 * berdampingan dengan fixture statis seed.
 *
 * Model draft vs published (kontrak §5/§9): editor SELALU bekerja pada `draft`;
 * situs publik membaca `published` — snapshot yang dibekukan saat publish.
 * Karena itu perubahan di editor hanya terlihat lewat `?preview=1` sampai user
 * menekan Publish. `published` masih null = belum pernah terbit.
 */
interface TenantSiteEntry {
  draft: TenantFixture;
  published: TenantFixture | null;
}

const managed = new Map<string, TenantSiteEntry>();

function validateFixture(subdomain: string, fixture: TenantFixture, label: string): TenantFixture {
  const parsed = tenantFixtureSchema.safeParse(fixture);
  if (!parsed.success) {
    throw new Error(
      `${label} untuk "${subdomain}" tidak lolos schema shared:\n${z.prettifyError(parsed.error)}`,
    );
  }
  if (parsed.data.site.tenant.subdomain !== subdomain) {
    throw new Error(`${label} "${subdomain}": subdomain di dalam situs harus "${subdomain}"`);
  }
  return parsed.data;
}

/**
 * Tulis draft situs tenant. Divalidasi terhadap schema shared di sini juga —
 * materializer/editor yang menghasilkan konten invalid gagal keras (setara
 * `422 VALIDATION_ERROR` dari backend nyata), bukan diam-diam lolos.
 */
export function setDraftSite(subdomain: string, fixture: TenantFixture): void {
  const draft = validateFixture(subdomain, fixture, "Draft situs");
  const entry = managed.get(subdomain);
  if (entry) entry.draft = draft;
  else managed.set(subdomain, { draft, published: null });
}

/** Bekukan draft jadi snapshot publik (dipanggil saat publish). */
export function publishDraftSite(subdomain: string, fixture: TenantFixture): void {
  const published = validateFixture(subdomain, fixture, "Snapshot publish");
  const entry = managed.get(subdomain);
  if (entry) entry.published = published;
  else managed.set(subdomain, { draft: published, published });
}

export function unregisterTenantSite(subdomain: string): void {
  managed.delete(subdomain);
}

/** Pindahkan draft + snapshot ke alamat baru (ganti subdomain sebelum terbit). */
export function renameTenantSite(from: string, to: string): void {
  const entry = managed.get(from);
  if (!entry) return;
  managed.delete(from);
  managed.set(to, entry);
}

/** Subdomain sudah dipakai fixture seed atau tenant dashboard? (cek ketersediaan §3) */
export function isSubdomainUsed(subdomain: string): boolean {
  return fixtures.has(subdomain) || managed.has(subdomain);
}

/**
 * Pilih sumber render: `?preview=1` membaca draft, publik membaca snapshot.
 * Fixture seed statis tidak punya pemisahan itu (dipakai untuk kedua jalur).
 */
function findFixture(subdomain: string, preview = false): TenantFixture {
  const entry = managed.get(subdomain);
  if (entry) {
    if (preview) return entry.draft;
    if (entry.published) return entry.published;
    // Belum pernah terbit → dari luar tidak boleh terlihat ada.
    throw new RenderApiError(404, "TENANT_NOT_FOUND", "Situs tidak ditemukan");
  }
  const fixture = fixtures.get(subdomain);
  if (!fixture) {
    throw new RenderApiError(404, "TENANT_NOT_FOUND", "Situs tidak ditemukan");
  }
  return fixture;
}

function assertAccessible(site: RenderTenantResponse, preview: boolean): void {
  if (preview) return; // TODO(Fase 7a): wajib sesi owner untuk draft/suspended
  const status = site.tenant.status;
  if (status === "suspended") {
    throw new RenderApiError(410, "TENANT_SUSPENDED", "Situs ini sedang dinonaktifkan");
  }
  if (status === "draft") {
    // Situs belum di-publish → dari luar tidak boleh terlihat ada.
    throw new RenderApiError(404, "TENANT_NOT_FOUND", "Situs tidak ditemukan");
  }
}

/** Mock GET /v1/render/:subdomain */
export function getMockSite(subdomain: string, preview = false): RenderTenantResponse {
  const fixture = findFixture(subdomain, preview);
  assertAccessible(fixture.site, preview);
  return fixture.site;
}

/** Mock GET /v1/render/:subdomain/pages/:pageSlug */
export function getMockPage(
  subdomain: string,
  pageSlug: string,
  preview = false,
): RenderPageResponse {
  const fixture = findFixture(subdomain, preview);
  assertAccessible(fixture.site, preview);
  const page = fixture.pages[pageSlug];
  if (!page) {
    throw new RenderApiError(404, "NOT_FOUND", "Halaman tidak ditemukan");
  }
  return page;
}

// ---------------------------------------------------------------------------
// Koleksi (Fase 4) — filter mengikuti kontrak §7, pagination cursor = offset.
// ---------------------------------------------------------------------------

interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

function paginate<T>(items: T[], limit: number, cursor?: string): Paginated<T> {
  const offset = cursor ? Number.parseInt(cursor, 10) || 0 : 0;
  const slice = items.slice(offset, offset + limit);
  const next = offset + limit < items.length ? String(offset + limit) : null;
  return { items: slice, nextCursor: next };
}

const contains = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.toLowerCase());

/** Mock GET /v1/render/:subdomain/vehicles — query §7 (q, brand, harga, tahun, transmisi). */
export function getMockVehicles(
  subdomain: string,
  rawQuery: unknown = {},
  preview = false,
): Paginated<Vehicle> {
  const fixture = findFixture(subdomain, preview);
  assertAccessible(fixture.site, preview);
  const query: VehicleQuery = vehicleQuerySchema.parse(rawQuery);
  let items = fixture.vehicles ?? [];
  if (query.q) items = items.filter((v) => contains(`${v.name} ${v.brand} ${v.model ?? ""}`, query.q!));
  if (query.brand) items = items.filter((v) => v.brand.toLowerCase() === query.brand!.toLowerCase());
  if (query.priceMin !== undefined) items = items.filter((v) => v.price >= query.priceMin!);
  if (query.priceMax !== undefined) items = items.filter((v) => v.price <= query.priceMax!);
  if (query.year !== undefined) items = items.filter((v) => v.year === query.year);
  if (query.transmission) items = items.filter((v) => v.transmission === query.transmission);
  // Default terbaru dulu (createdAt desc) — kontrak §7 tidak punya param sort.
  items = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(items, query.limit, query.cursor);
}

/** Mock GET /v1/render/:subdomain/products — query §7 (q, category, harga). */
export function getMockProducts(
  subdomain: string,
  rawQuery: unknown = {},
  preview = false,
): Paginated<Product> {
  const fixture = findFixture(subdomain, preview);
  assertAccessible(fixture.site, preview);
  const query: ProductQuery = productQuerySchema.parse(rawQuery);
  let items = fixture.products ?? [];
  if (query.q) items = items.filter((p) => contains(`${p.name} ${p.category ?? ""}`, query.q!));
  if (query.category)
    items = items.filter((p) => (p.category ?? "").toLowerCase() === query.category!.toLowerCase());
  if (query.priceMin !== undefined) items = items.filter((p) => p.price >= query.priceMin!);
  if (query.priceMax !== undefined) items = items.filter((p) => p.price <= query.priceMax!);
  items = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(items, query.limit, query.cursor);
}

/** Mock GET /v1/render/:subdomain/vehicles/:slug — item penuh untuk VDP (Fase 5). */
export function getMockVehicle(subdomain: string, slug: string, preview = false): Vehicle {
  const fixture = findFixture(subdomain, preview);
  assertAccessible(fixture.site, preview);
  const vehicle = (fixture.vehicles ?? []).find((v) => v.slug === slug);
  if (!vehicle) {
    throw new RenderApiError(404, "NOT_FOUND", "Unit tidak ditemukan");
  }
  return vehicle;
}

/** Mock GET /v1/render/:subdomain/products/:slug — item penuh untuk PDP (Fase 5). */
export function getMockProduct(subdomain: string, slug: string, preview = false): Product {
  const fixture = findFixture(subdomain, preview);
  assertAccessible(fixture.site, preview);
  const product = (fixture.products ?? []).find((p) => p.slug === slug);
  if (!product) {
    throw new RenderApiError(404, "NOT_FOUND", "Produk tidak ditemukan");
  }
  return product;
}

/**
 * Mock GET /v1/render/:subdomain/sitemap (Fase 6) — daftar URL publik tenant:
 * halaman + item koleksi (VDP /mobil, PDP /produk). Backend nyata membangun ini
 * dari snapshot published + collection; mock menurunkannya dari fixture.
 */
export function getMockSitemap(subdomain: string, preview = false): RenderSitemapResponse {
  const fixture = findFixture(subdomain, preview);
  assertAccessible(fixture.site, preview);

  const publishedAt = fixture.site.tenant.publishedAt ?? new Date().toISOString();
  const urls: RenderSitemapResponse["urls"] = [];

  for (const slug of Object.keys(fixture.pages)) {
    // Render page response tidak memuat updatedAt per halaman → pakai publishedAt.
    urls.push({ path: slug === "home" ? "/" : `/${slug}`, updatedAt: publishedAt });
  }
  // Halaman listing koleksi + tiap item (URL sendiri = crawlable, Fase 5).
  if (fixture.vehicles?.length) {
    urls.push({ path: "/mobil", updatedAt: publishedAt });
    for (const v of fixture.vehicles) {
      urls.push({ path: `/mobil/${v.slug}`, updatedAt: v.updatedAt });
    }
  }
  if (fixture.products?.length) {
    urls.push({ path: "/produk", updatedAt: publishedAt });
    for (const p of fixture.products) {
      urls.push({ path: `/produk/${p.slug}`, updatedAt: p.updatedAt });
    }
  }
  return { urls };
}

// ---------------------------------------------------------------------------
// Leads (Fase 4) — mock POST /v1/public/:subdomain/leads (kontrak §8).
// ---------------------------------------------------------------------------

/** Penyimpanan in-memory untuk inspeksi dev/test; reset tiap restart. */
export const mockLeads: (Lead & { subdomain: string })[] = [];

export function createMockLead(subdomain: string, request: CreateLeadRequest): { id: string } {
  const parsed = createLeadRequestSchema.parse(request);
  const fixture = findFixture(subdomain);
  if (fixture.site.tenant.status !== "active") {
    throw new RenderApiError(409, "TENANT_NOT_ACTIVE", "Situs belum menerima pesan");
  }
  const id = crypto.randomUUID();
  mockLeads.push({
    id,
    type: parsed.type,
    payload: parsed.payload,
    ...(parsed.sourceItemSlug ? { sourceItemSlug: parsed.sourceItemSlug } : {}),
    read: false,
    createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    subdomain,
  });
  return { id };
}
