/**
 * Wrapper $fetch ke backend render API (NestJS /v1/render/*), server-to-server
 * dengan header X-Service-Token. Saat runtimeConfig.renderMock aktif (default
 * Fase 1), data diambil dari fixture lokal (server/mock/render-store.ts).
 * Error dinormalisasi ke H3Error ber-statusCode + data.error sesuai kontrak §1.4.
 */
import type { H3Event } from "h3";
import type {
  CreateLeadRequest,
  CreateLeadResponse,
  Product,
  RenderPageResponse,
  RenderSitemapResponse,
  RenderTenantResponse,
  Vehicle,
} from "@marketplaceindo/shared";
import { FetchError } from "ofetch";
import {
  RenderApiError,
  createMockLead,
  getMockPage,
  getMockProduct,
  getMockProducts,
  getMockSite,
  getMockSitemap,
  getMockVehicle,
  getMockVehicles,
} from "../mock/render-store";

interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * `$fetch` untuk URL **eksternal** (backend NestJS). Sengaja di-cast ke tanda
 * tangan longgar: tipe bawaan Nuxt mencoba mencocokkan URL ke tabel route
 * internal, dan seiring bertambahnya route dashboard inferensinya meledak
 * ("excessive stack depth"). URL di sini absolut ke host lain, jadi pencocokan
 * itu memang tidak relevan.
 */
const fetchExternal = $fetch as unknown as <T>(
  url: string,
  opts?: Record<string, unknown>,
) => Promise<T>;

export interface RenderOptions {
  /** Render draft snapshot (?preview=1). Sesi owner divalidasi backend (Fase 7a). */
  preview?: boolean;
}

function toH3Error(err: unknown): never {
  if (err instanceof RenderApiError) {
    throw createError({
      statusCode: err.status,
      message: err.message,
      data: { error: { code: err.code, message: err.message } },
    });
  }
  if (err instanceof FetchError) {
    const body = err.data as { error?: { code?: string; message?: string } } | undefined;
    throw createError({
      statusCode: err.statusCode ?? 502,
      message: body?.error?.message ?? "Render API tidak dapat dihubungi",
      data: { error: body?.error ?? { code: "INTERNAL", message: "Render API error" } },
    });
  }
  throw err;
}

function renderFetch<T>(event: H3Event, path: string, opts: RenderOptions): Promise<T> {
  const config = useRuntimeConfig(event);
  return fetchExternal<T>(`${config.renderApiBase}${path}`, {
    headers: { "X-Service-Token": config.renderServiceToken },
    query: opts.preview ? { preview: "1" } : undefined,
  });
}

/** GET /v1/render/:subdomain — data global situs (theme, nav, kontak). */
export async function fetchRenderSite(
  event: H3Event,
  subdomain: string,
  opts: RenderOptions = {},
): Promise<RenderTenantResponse> {
  const config = useRuntimeConfig(event);
  try {
    if (config.renderMock) return getMockSite(subdomain, opts.preview);
    return await renderFetch<RenderTenantResponse>(event, `/render/${subdomain}`, opts);
  } catch (err) {
    toH3Error(err);
  }
}

/** GET /v1/render/:subdomain/pages/:pageSlug — konten satu halaman. */
export async function fetchRenderPage(
  event: H3Event,
  subdomain: string,
  pageSlug: string,
  opts: RenderOptions = {},
): Promise<RenderPageResponse> {
  const config = useRuntimeConfig(event);
  try {
    if (config.renderMock) return getMockPage(subdomain, pageSlug, opts.preview);
    return await renderFetch<RenderPageResponse>(
      event,
      `/render/${subdomain}/pages/${pageSlug}`,
      opts,
    );
  } catch (err) {
    toH3Error(err);
  }
}

/** GET /v1/render/:subdomain/sitemap — daftar URL publik tenant (Fase 6). */
export async function fetchRenderSitemap(
  event: H3Event,
  subdomain: string,
  opts: RenderOptions = {},
): Promise<RenderSitemapResponse> {
  const config = useRuntimeConfig(event);
  try {
    if (config.renderMock) return getMockSitemap(subdomain, opts.preview);
    return await renderFetch<RenderSitemapResponse>(event, `/render/${subdomain}/sitemap`, opts);
  } catch (err) {
    toH3Error(err);
  }
}

/** GET /v1/render/:subdomain/vehicles — list + filter §7. */
export async function fetchRenderVehicles(
  event: H3Event,
  subdomain: string,
  query: Record<string, unknown>,
  opts: RenderOptions = {},
): Promise<Paginated<Vehicle>> {
  const config = useRuntimeConfig(event);
  try {
    if (config.renderMock) return getMockVehicles(subdomain, query, opts.preview);
    return await fetchExternal<Paginated<Vehicle>>(`${config.renderApiBase}/render/${subdomain}/vehicles`, {
      headers: { "X-Service-Token": config.renderServiceToken },
      query: { ...query, ...(opts.preview ? { preview: "1" } : {}) },
    });
  } catch (err) {
    toH3Error(err);
  }
}

/** GET /v1/render/:subdomain/products — list + filter §7. */
export async function fetchRenderProducts(
  event: H3Event,
  subdomain: string,
  query: Record<string, unknown>,
  opts: RenderOptions = {},
): Promise<Paginated<Product>> {
  const config = useRuntimeConfig(event);
  try {
    if (config.renderMock) return getMockProducts(subdomain, query, opts.preview);
    return await fetchExternal<Paginated<Product>>(`${config.renderApiBase}/render/${subdomain}/products`, {
      headers: { "X-Service-Token": config.renderServiceToken },
      query: { ...query, ...(opts.preview ? { preview: "1" } : {}) },
    });
  } catch (err) {
    toH3Error(err);
  }
}

/** GET /v1/render/:subdomain/vehicles/:slug — item penuh untuk VDP (Fase 5). */
export async function fetchRenderVehicle(
  event: H3Event,
  subdomain: string,
  slug: string,
  opts: RenderOptions = {},
): Promise<Vehicle> {
  const config = useRuntimeConfig(event);
  try {
    if (config.renderMock) return getMockVehicle(subdomain, slug, opts.preview);
    return await renderFetch<Vehicle>(event, `/render/${subdomain}/vehicles/${slug}`, opts);
  } catch (err) {
    toH3Error(err);
  }
}

/** GET /v1/render/:subdomain/products/:slug — item penuh untuk PDP (Fase 5). */
export async function fetchRenderProduct(
  event: H3Event,
  subdomain: string,
  slug: string,
  opts: RenderOptions = {},
): Promise<Product> {
  const config = useRuntimeConfig(event);
  try {
    if (config.renderMock) return getMockProduct(subdomain, slug, opts.preview);
    return await renderFetch<Product>(event, `/render/${subdomain}/products/${slug}`, opts);
  } catch (err) {
    toH3Error(err);
  }
}

/** POST /v1/public/:subdomain/leads — dipanggil route Nuxt /api/leads (bukan browser langsung). */
export async function submitPublicLead(
  event: H3Event,
  subdomain: string,
  body: CreateLeadRequest,
): Promise<CreateLeadResponse> {
  const config = useRuntimeConfig(event);
  try {
    if (config.renderMock) return createMockLead(subdomain, body);
    return await fetchExternal<CreateLeadResponse>(`${config.renderApiBase}/public/${subdomain}/leads`, {
      method: "POST",
      headers: { "X-Service-Token": config.renderServiceToken },
      body,
    });
  } catch (err) {
    toH3Error(err);
  }
}
