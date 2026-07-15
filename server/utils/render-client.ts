/**
 * Wrapper $fetch ke backend render API (NestJS /v1/render/*), server-to-server
 * dengan header X-Service-Token. Saat runtimeConfig.renderMock aktif (default
 * Fase 1), data diambil dari fixture lokal (server/mock/render-store.ts).
 * Error dinormalisasi ke H3Error ber-statusCode + data.error sesuai kontrak §1.4.
 */
import type { H3Event } from "h3";
import type {
  RenderPageResponse,
  RenderTenantResponse,
} from "@marketplaceindo/shared";
import { FetchError } from "ofetch";
import { RenderApiError, getMockPage, getMockSite } from "../mock/render-store";

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
  return $fetch<T>(`${config.renderApiBase}${path}`, {
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
