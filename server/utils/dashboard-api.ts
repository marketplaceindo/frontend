/**
 * Jembatan dashboard → modul Tenants/Billing (Fase 7b). Browser memanggil route
 * Nitro `/api/tenants/*` dan `/api/billing/*`; di sini dipilih antara mock
 * in-memory (default dev) dan proxy ke NestJS `/v1/*` dengan `Authorization:
 * Bearer` dari cookie httpOnly — token tidak pernah menyentuh JS browser
 * (keputusan terkunci CLAUDE.md).
 *
 * Semua error dinormalisasi ke H3Error ber-`data.error` sesuai kontrak §1.4.
 */
import type { H3Event } from "h3";
import { ZodError } from "zod";
import { FetchError } from "ofetch";
import type {
  BillingStatusResponse,
  Block,
  CheckSubdomainResponse,
  Page,
  PageDetailResponse,
  PresignResponse,
  Product,
  PublishResponse,
  Section,
  SubscribeResponse,
  TemplateDetailResponse,
  Tenant,
  TemplatesResponse,
  User,
  VehicleModel,
  VehicleUnit,
  WizardResponse,
  CatalogBrandsResponse,
  CatalogCitiesResponse,
  CatalogModelsResponse,
  InventoryPriceImportResult,
  SeedInventoryResult,
  VehicleVertical,
} from "@marketplaceindo/shared";
import { TenantApiError } from "../mock/api-error";
import {
  checkSubdomain,
  createTenant,
  getTenant,
  listTenants,
  publishTenant,
  runWizard,
  syncDraftSite,
  updateSubdomain,
  updateTheme,
} from "../mock/tenant-store";
import {
  createPage,
  deletePage,
  getPageDetail,
  listPages,
  replaceBlocks,
  tenantIdOfPage,
  updatePage,
  updateSection,
} from "../mock/content-store";
import {
  createProduct,
  createVehicle,
  deleteProduct,
  deleteVehicle,
  listProducts,
  listVehicles,
  tenantIdOfItem,
  updateProduct,
  updateVehicle,
} from "../mock/collection-store";
import {
  catalogBrands,
  catalogCities,
  catalogModels,
  seedInventory,
} from "../mock/catalog-store";
import { exportPrices, importPrices } from "../mock/inventory-price-store";
import { mediaBelongsTo, presignUpload, readUpload, storeUpload } from "../mock/media-store";
import {
  createVehicleModel,
  deleteVehicleModel,
  listVehicleModels,
  tenantIdOfModel,
  updateVehicleModel,
} from "../mock/vehicle-model-store";
import { templateDetail, templateSummaries } from "../mock/templates";
import {
  billingStatus,
  findInvoice,
  hasActiveSubscription,
  payMockInvoice,
  subscribe,
} from "../mock/billing-store";
import { currentAccessToken, currentUser } from "./dashboard-auth";
import { requestOrigin } from "./request-origin";
import { knownBaseDomains } from "./tenant-host";

/** Sesi wajib untuk seluruh area dashboard; tanpa itu → 401 (kontrak §12). */
export function requireUser(event: H3Event): User {
  const user = currentUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      message: "Silakan masuk dulu",
      data: { error: { code: "UNAUTHORIZED", message: "Silakan masuk dulu" } },
    });
  }
  return user;
}

/**
 * Origin absolut situs tenant (mis. `http://warungbudi.lvh.me:3000`), diturunkan
 * dari Host request supaya benar di dev (lvh.me + port) maupun produksi.
 */
export function tenantOrigin(event: H3Event, subdomain: string): string {
  const config = useRuntimeConfig(event);
  const proto = getRequestProtocol(event, { xForwardedProto: true });
  const [hostname = "", port] = getRequestHost(event, { xForwardedHost: true }).split(":");
  const base =
    knownBaseDomains(config.public.baseDomain).find(
      (b) => hostname === b || hostname.endsWith(`.${b}`),
    ) ?? config.public.baseDomain;
  return `${proto}://${subdomain}.${base}${port ? `:${port}` : ""}`;
}

function toH3Error(err: unknown): never {
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    throw createError({
      statusCode: 422,
      message: "Data tidak valid",
      data: { error: { code: "VALIDATION_ERROR", message: "Data tidak valid", fieldErrors } },
    });
  }
  if (err instanceof TenantApiError) {
    // `fieldErrors` boleh ikut di details (§1.4) — angkat ke level error agar
    // form dashboard memetakannya sama seperti error validasi backend.
    const { fieldErrors, ...details } = (err.details ?? {}) as {
      fieldErrors?: Record<string, string[]>;
    };
    throw createError({
      statusCode: err.status,
      message: err.message,
      data: {
        error: {
          code: err.code,
          message: err.message,
          ...(fieldErrors ? { fieldErrors } : {}),
          ...(Object.keys(details).length ? { details } : {}),
        },
      },
    });
  }
  if (err instanceof FetchError) {
    const body = err.data as { error?: { code?: string; message?: string } } | undefined;
    throw createError({
      statusCode: err.statusCode ?? 502,
      message: body?.error?.message ?? "Layanan tidak dapat dihubungi",
      data: { error: body?.error ?? { code: "INTERNAL", message: "Dashboard API error" } },
    });
  }
  throw err;
}

/**
 * `$fetch` untuk URL **eksternal** (backend NestJS). Di-cast ke tanda tangan
 * longgar: tipe bawaan Nuxt mencoba mencocokkan URL ke tabel route internal dan
 * inferensinya meledak seiring bertambahnya route ("excessive stack depth").
 * URL di sini absolut ke host lain, jadi pencocokan itu memang tidak relevan.
 */
const fetchExternal = $fetch as unknown as <T>(
  url: string,
  opts?: Record<string, unknown>,
) => Promise<T>;

/** Proxy ke NestJS dengan Bearer token sesi (dipakai saat dashboardMock=false). */
function proxy<T>(
  event: H3Event,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  opts: { body?: unknown; query?: Record<string, unknown> } = {},
): Promise<T> {
  const config = useRuntimeConfig(event);
  const token = currentAccessToken(event);
  return fetchExternal<T>(`${config.dashboardApiBase}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    ...(opts.body !== undefined ? { body: opts.body } : {}),
    ...(opts.query ? { query: opts.query } : {}),
  });
}

const isMock = (event: H3Event) => useRuntimeConfig(event).dashboardMock;

// ---------------------------------------------------------------------------
// Tenants & onboarding (kontrak §3)
// ---------------------------------------------------------------------------

export async function apiListTenants(event: H3Event): Promise<{ items: Tenant[] }> {
  const user = requireUser(event);
  try {
    if (isMock(event)) return listTenants(user.id);
    return await proxy<{ items: Tenant[] }>(event, "GET", "/tenants/me");
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiCreateTenant(event: H3Event): Promise<Tenant> {
  const user = requireUser(event);
  try {
    if (isMock(event)) return createTenant(user.id);
    return await proxy<Tenant>(event, "POST", "/tenants", { body: {} });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiCheckSubdomain(
  event: H3Event,
  body: unknown,
): Promise<CheckSubdomainResponse> {
  requireUser(event);
  try {
    if (isMock(event)) return checkSubdomain(body);
    return await proxy<CheckSubdomainResponse>(event, "POST", "/tenants/check-subdomain", { body });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiUpdateSubdomain(
  event: H3Event,
  tenantId: string,
  body: unknown,
): Promise<Tenant> {
  const user = requireUser(event);
  try {
    if (isMock(event)) return updateSubdomain(user.id, tenantId, body);
    return await proxy<Tenant>(event, "PATCH", `/tenants/${tenantId}/subdomain`, { body });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiRunWizard(
  event: H3Event,
  tenantId: string,
  body: unknown,
): Promise<WizardResponse> {
  const user = requireUser(event);
  try {
    if (isMock(event)) {
      return runWizard(user.id, tenantId, body, (sub) => tenantOrigin(event, sub));
    }
    return await proxy<WizardResponse>(event, "POST", `/tenants/${tenantId}/wizard`, { body });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiPublishTenant(
  event: H3Event,
  tenantId: string,
): Promise<PublishResponse> {
  const user = requireUser(event);
  try {
    if (isMock(event)) {
      return publishTenant(user.id, tenantId, {
        hasSubscription: hasActiveSubscription(tenantId),
        liveOrigin: (sub) => tenantOrigin(event, sub),
      });
    }
    return await proxy<PublishResponse>(event, "POST", `/tenants/${tenantId}/publish`, { body: {} });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiUpdateTheme(
  event: H3Event,
  tenantId: string,
  body: unknown,
): Promise<Tenant> {
  const user = requireUser(event);
  try {
    if (isMock(event)) return updateTheme(user.id, tenantId, body);
    return await proxy<Tenant>(event, "PATCH", `/tenants/${tenantId}/theme`, { body });
  } catch (err) {
    toH3Error(err);
  }
}

// ---------------------------------------------------------------------------
// Templates (kontrak §4)
// ---------------------------------------------------------------------------

export async function apiListTemplates(event: H3Event): Promise<TemplatesResponse> {
  requireUser(event);
  try {
    if (isMock(event)) return { items: templateSummaries() };
    return await proxy<TemplatesResponse>(event, "GET", "/templates");
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiTemplateDetail(
  event: H3Event,
  slug: string,
): Promise<TemplateDetailResponse> {
  requireUser(event);
  try {
    if (isMock(event)) {
      const detail = templateDetail(slug);
      if (!detail) throw new TenantApiError(404, "NOT_FOUND", "Template tidak ditemukan");
      return detail;
    }
    return await proxy<TemplateDetailResponse>(event, "GET", `/templates/${slug}`);
  } catch (err) {
    toH3Error(err);
  }
}

// ---------------------------------------------------------------------------
// Content: pages, sections, blocks (kontrak §5)
// ---------------------------------------------------------------------------

/**
 * Kontrak §5 memakai `/pages/:pageId` tanpa segmen tenant, jadi kepemilikan
 * ditegakkan lewat indeks pageId → tenantId lalu cek pemilik tenant.
 */
function ownedTenantOfPage(event: H3Event, pageId: string): { userId: string; tenantId: string } {
  const user = requireUser(event);
  const tenantId = tenantIdOfPage(pageId);
  getTenant(user.id, tenantId); // melempar 403/404 bila bukan milik user
  return { userId: user.id, tenantId };
}

export async function apiListPages(event: H3Event, tenantId: string): Promise<{ items: Page[] }> {
  const user = requireUser(event);
  try {
    if (isMock(event)) {
      getTenant(user.id, tenantId);
      return listPages(tenantId);
    }
    return await proxy<{ items: Page[] }>(event, "GET", `/tenants/${tenantId}/pages`);
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiCreatePage(
  event: H3Event,
  tenantId: string,
  body: unknown,
): Promise<Page> {
  const user = requireUser(event);
  try {
    if (isMock(event)) {
      getTenant(user.id, tenantId);
      const page = createPage(tenantId, body);
      syncDraftSite(tenantId);
      return page;
    }
    return await proxy<Page>(event, "POST", `/tenants/${tenantId}/pages`, { body });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiGetPage(event: H3Event, pageId: string): Promise<PageDetailResponse> {
  requireUser(event);
  try {
    if (isMock(event)) {
      const { tenantId } = ownedTenantOfPage(event, pageId);
      return getPageDetail(tenantId, pageId);
    }
    return await proxy<PageDetailResponse>(event, "GET", `/pages/${pageId}`);
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiUpdatePage(
  event: H3Event,
  pageId: string,
  body: unknown,
): Promise<Page> {
  requireUser(event);
  try {
    if (isMock(event)) {
      const { tenantId } = ownedTenantOfPage(event, pageId);
      const page = updatePage(tenantId, pageId, body);
      syncDraftSite(tenantId);
      return page;
    }
    return await proxy<Page>(event, "PATCH", `/pages/${pageId}`, { body });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiDeletePage(event: H3Event, pageId: string): Promise<void> {
  requireUser(event);
  try {
    if (isMock(event)) {
      const { tenantId } = ownedTenantOfPage(event, pageId);
      deletePage(tenantId, pageId);
      syncDraftSite(tenantId);
      return;
    }
    await proxy<void>(event, "DELETE", `/pages/${pageId}`);
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiUpdateSection(
  event: H3Event,
  pageId: string,
  sectionId: string,
  body: unknown,
): Promise<Section> {
  requireUser(event);
  try {
    if (isMock(event)) {
      const { tenantId } = ownedTenantOfPage(event, pageId);
      const section = updateSection(tenantId, pageId, sectionId, body);
      syncDraftSite(tenantId);
      return section;
    }
    return await proxy<Section>(event, "PATCH", `/pages/${pageId}/sections/${sectionId}`, { body });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiReplaceBlocks(
  event: H3Event,
  pageId: string,
  sectionId: string,
  body: unknown,
): Promise<{ blocks: Block[] }> {
  const user = requireUser(event);
  try {
    if (isMock(event)) {
      const { tenantId } = ownedTenantOfPage(event, pageId);
      const tenant = getTenant(user.id, tenantId);
      const result = replaceBlocks(tenantId, pageId, sectionId, body, tenant.templateId);
      syncDraftSite(tenantId);
      return result;
    }
    return await proxy<{ blocks: Block[] }>(
      event,
      "PUT",
      `/pages/${pageId}/sections/${sectionId}/blocks`,
      { body },
    );
  } catch (err) {
    toH3Error(err);
  }
}

// ---------------------------------------------------------------------------
// Media (kontrak §6)
// ---------------------------------------------------------------------------

export async function apiPresignMedia(
  event: H3Event,
  tenantId: string,
  body: unknown,
): Promise<PresignResponse> {
  const user = requireUser(event);
  try {
    if (isMock(event)) {
      getTenant(user.id, tenantId);
      const origin = requestOrigin(event);
      return presignUpload(tenantId, body, (mediaId) => ({
        uploadUrl: `${origin}/api/media/${mediaId}`,
        fileUrl: `${origin}/api/media/${mediaId}`,
      }));
    }
    return await proxy<PresignResponse>(event, "POST", `/tenants/${tenantId}/media/presign`, {
      body,
    });
  } catch (err) {
    toH3Error(err);
  }
}

/** Terima byte upload (mock object storage). Hanya pemilik media yang boleh. */
export function apiStoreMedia(event: H3Event, mediaId: string, bytes: Uint8Array): void {
  const user = requireUser(event);
  try {
    const owned = listTenants(user.id).items.some((t) => mediaBelongsTo(mediaId, t.id));
    if (!owned) throw new TenantApiError(403, "FORBIDDEN", "Media ini bukan milikmu");
    storeUpload(mediaId, bytes);
  } catch (err) {
    toH3Error(err);
  }
}

/** Sajikan file (mock CDN) — publik, seperti object storage sungguhan. */
export function apiReadMedia(mediaId: string): { bytes: Uint8Array; mimeType: string } {
  try {
    return readUpload(mediaId);
  } catch (err) {
    toH3Error(err);
  }
}

// ---------------------------------------------------------------------------
// Collections: vehicles & products (kontrak §7)
// ---------------------------------------------------------------------------

function ownedTenantOfItem(event: H3Event, itemId: string): string {
  const user = requireUser(event);
  const tenantId = tenantIdOfItem(itemId);
  getTenant(user.id, tenantId);
  return tenantId;
}

type Collection = "vehicles" | "products";

export async function apiListCollection(
  event: H3Event,
  collection: Collection,
  tenantId: string,
  query: Record<string, unknown>,
) {
  const user = requireUser(event);
  try {
    if (isMock(event)) {
      getTenant(user.id, tenantId);
      return collection === "vehicles"
        ? listVehicles(tenantId, query)
        : listProducts(tenantId, query);
    }
    return await proxy(event, "GET", `/tenants/${tenantId}/${collection}`, { query });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiCreateCollectionItem(
  event: H3Event,
  collection: Collection,
  tenantId: string,
  body: unknown,
): Promise<VehicleUnit | Product> {
  const user = requireUser(event);
  try {
    if (isMock(event)) {
      getTenant(user.id, tenantId);
      const item =
        collection === "vehicles" ? createVehicle(tenantId, body) : createProduct(tenantId, body);
      syncDraftSite(tenantId);
      return item;
    }
    return await proxy<VehicleUnit | Product>(event, "POST", `/tenants/${tenantId}/${collection}`, {
      body,
    });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiUpdateCollectionItem(
  event: H3Event,
  collection: Collection,
  itemId: string,
  body: unknown,
): Promise<VehicleUnit | Product> {
  requireUser(event);
  try {
    if (isMock(event)) {
      const tenantId = ownedTenantOfItem(event, itemId);
      const item =
        collection === "vehicles"
          ? updateVehicle(tenantId, itemId, body)
          : updateProduct(tenantId, itemId, body);
      syncDraftSite(tenantId);
      return item;
    }
    return await proxy<VehicleUnit | Product>(event, "PATCH", `/${collection}/${itemId}`, { body });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiDeleteCollectionItem(
  event: H3Event,
  collection: Collection,
  itemId: string,
): Promise<void> {
  requireUser(event);
  try {
    if (isMock(event)) {
      const tenantId = ownedTenantOfItem(event, itemId);
      if (collection === "vehicles") deleteVehicle(tenantId, itemId);
      else deleteProduct(tenantId, itemId);
      syncDraftSite(tenantId);
      return;
    }
    await proxy<void>(event, "DELETE", `/${collection}/${itemId}`);
  } catch (err) {
    toH3Error(err);
  }
}

// ---------------------------------------------------------------------------
// Vehicle models — kendaraan baru (kontrak §7.1)
// ---------------------------------------------------------------------------

/** Kontrak §7.1 memakai `/vehicle-models/:modelId` tanpa segmen tenant. */
function ownedTenantOfModel(event: H3Event, modelId: string): string {
  const user = requireUser(event);
  const tenantId = tenantIdOfModel(modelId);
  getTenant(user.id, tenantId);
  return tenantId;
}

export async function apiListVehicleModels(
  event: H3Event,
  tenantId: string,
  query: Record<string, unknown>,
) {
  const user = requireUser(event);
  try {
    if (isMock(event)) {
      getTenant(user.id, tenantId);
      return listVehicleModels(tenantId, query);
    }
    return await proxy(event, "GET", `/tenants/${tenantId}/vehicle-models`, { query });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiCreateVehicleModel(
  event: H3Event,
  tenantId: string,
  body: unknown,
): Promise<VehicleModel> {
  const user = requireUser(event);
  try {
    if (isMock(event)) {
      getTenant(user.id, tenantId);
      const model = createVehicleModel(tenantId, body);
      syncDraftSite(tenantId);
      return model;
    }
    return await proxy<VehicleModel>(event, "POST", `/tenants/${tenantId}/vehicle-models`, { body });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiUpdateVehicleModel(
  event: H3Event,
  modelId: string,
  body: unknown,
): Promise<VehicleModel> {
  requireUser(event);
  try {
    if (isMock(event)) {
      const tenantId = ownedTenantOfModel(event, modelId);
      const model = updateVehicleModel(tenantId, modelId, body);
      syncDraftSite(tenantId);
      return model;
    }
    return await proxy<VehicleModel>(event, "PATCH", `/vehicle-models/${modelId}`, { body });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiDeleteVehicleModel(event: H3Event, modelId: string): Promise<void> {
  requireUser(event);
  try {
    if (isMock(event)) {
      const tenantId = ownedTenantOfModel(event, modelId);
      deleteVehicleModel(tenantId, modelId);
      syncDraftSite(tenantId);
      return;
    }
    await proxy<void>(event, "DELETE", `/vehicle-models/${modelId}`);
  } catch (err) {
    toH3Error(err);
  }
}

// ---------------------------------------------------------------------------
// Billing (kontrak §9)
// ---------------------------------------------------------------------------

export async function apiSubscribe(event: H3Event, body: unknown): Promise<SubscribeResponse> {
  const user = requireUser(event);
  try {
    if (isMock(event)) {
      const origin = getRequestProtocol(event, { xForwardedProto: true });
      const host = getRequestHost(event, { xForwardedHost: true });
      return subscribe(user.id, body, (id) => `${origin}://${host}/bayar-simulasi?invoice=${id}`);
    }
    const idempotencyKey = getHeader(event, "idempotency-key");
    const config = useRuntimeConfig(event);
    const token = currentAccessToken(event);
    return await fetchExternal<SubscribeResponse>(`${config.dashboardApiBase}/billing/subscribe`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body,
    });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiBillingStatus(
  event: H3Event,
  tenantId: string,
): Promise<BillingStatusResponse> {
  const user = requireUser(event);
  try {
    if (isMock(event)) return billingStatus(user.id, tenantId);
    return await proxy<BillingStatusResponse>(event, "GET", "/billing/status", {
      query: { tenantId },
    });
  } catch (err) {
    toH3Error(err);
  }
}

/**
 * Checkout simulasi (mock saja). Di produksi user membayar di halaman Xendit dan
 * status berubah lewat webhook — tidak ada padanan endpoint ini.
 */
export function apiMockCheckout(event: H3Event, invoiceId: string) {
  const user = requireUser(event);
  if (!isMock(event)) {
    throw createError({
      statusCode: 404,
      message: "Tidak tersedia",
      data: { error: { code: "NOT_FOUND", message: "Tidak tersedia" } },
    });
  }
  try {
    const invoice = findInvoice(user.id, invoiceId);
    return {
      id: invoice.id,
      amount: invoice.amount,
      status: invoice.status,
      plan: invoice.plan,
      expiresAt: invoice.expiresAt,
    };
  } catch (err) {
    toH3Error(err);
  }
}

export function apiMockPay(event: H3Event, invoiceId: string): { paid: true } {
  const user = requireUser(event);
  if (!isMock(event)) {
    throw createError({
      statusCode: 404,
      message: "Tidak tersedia",
      data: { error: { code: "NOT_FOUND", message: "Tidak tersedia" } },
    });
  }
  try {
    return payMockInvoice(user.id, invoiceId);
  } catch (err) {
    toH3Error(err);
  }
}

// ---------------------------------------------------------------------------
// Katalog seed kendaraan baru (kontrak §7.4–§7.6)
// ---------------------------------------------------------------------------

/**
 * `/catalog/*` adalah endpoint **publik** di backend — wizard memanggilnya
 * sebelum tenant punya apa pun. Route Nitro-nya tetap butuh sesi dashboard
 * karena hanya dipakai dari dalam dashboard; itu pengetatan, bukan pelonggaran.
 */
export async function apiCatalogBrands(
  event: H3Event,
  vertical: VehicleVertical,
): Promise<CatalogBrandsResponse> {
  requireUser(event);
  try {
    if (isMock(event)) return catalogBrands(vertical);
    return await proxy<CatalogBrandsResponse>(event, "GET", "/catalog/brands", {
      query: { vertical },
    });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiCatalogCities(
  event: H3Event,
  vertical: VehicleVertical,
): Promise<CatalogCitiesResponse> {
  requireUser(event);
  try {
    if (isMock(event)) return catalogCities(vertical);
    return await proxy<CatalogCitiesResponse>(event, "GET", "/catalog/cities", {
      query: { vertical },
    });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiCatalogModels(
  event: H3Event,
  brandId: string,
  cityCode: string,
): Promise<CatalogModelsResponse> {
  requireUser(event);
  try {
    if (isMock(event)) return catalogModels(brandId, cityCode);
    return await proxy<CatalogModelsResponse>(event, "GET", "/catalog/models", {
      query: { brandId, cityCode },
    });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiSeedInventory(
  event: H3Event,
  tenantId: string,
  body: unknown,
): Promise<SeedInventoryResult> {
  const user = requireUser(event);
  try {
    if (isMock(event)) {
      getTenant(user.id, tenantId);
      const result = seedInventory(tenantId, body);
      syncDraftSite(tenantId);
      return result;
    }
    return await proxy<SeedInventoryResult>(event, "POST", `/tenants/${tenantId}/seed-inventory`, {
      body,
    });
  } catch (err) {
    toH3Error(err);
  }
}

/** Unduhan file harga. Mock mengembalikan CSV; backend mengembalikan .xlsx. */
export async function apiExportPrices(
  event: H3Event,
  tenantId: string,
): Promise<{ body: string | ArrayBuffer; contentType: string; filename: string }> {
  const user = requireUser(event);
  try {
    if (isMock(event)) {
      getTenant(user.id, tenantId);
      return {
        body: exportPrices(tenantId),
        contentType: "text/csv; charset=utf-8",
        filename: "harga.csv",
      };
    }
    const config = useRuntimeConfig(event);
    const token = currentAccessToken(event);
    const buffer = await fetchExternal<ArrayBuffer>(
      `${config.dashboardApiBase}/tenants/${tenantId}/inventory/prices.xlsx`,
      {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        responseType: "arrayBuffer",
      },
    );
    return {
      body: buffer,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: "harga.xlsx",
    };
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiImportPrices(
  event: H3Event,
  tenantId: string,
  file: { data: Uint8Array; filename: string },
): Promise<InventoryPriceImportResult> {
  const user = requireUser(event);
  try {
    if (isMock(event)) {
      getTenant(user.id, tenantId);
      const result = importPrices(tenantId, new TextDecoder().decode(file.data));
      syncDraftSite(tenantId);
      return result;
    }
    const config = useRuntimeConfig(event);
    const token = currentAccessToken(event);
    const form = new FormData();
    form.append("file", new Blob([file.data as BlobPart]), file.filename);
    return await fetchExternal<InventoryPriceImportResult>(
      `${config.dashboardApiBase}/tenants/${tenantId}/inventory/prices.xlsx`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      },
    );
  } catch (err) {
    toH3Error(err);
  }
}
