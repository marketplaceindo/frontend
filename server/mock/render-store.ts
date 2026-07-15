/**
 * Mock render API (Fase 1) — sumber data fixture JSON, divalidasi schema shared
 * saat load. Meniru semantik kontrak §10 (Render API):
 * - subdomain tak dikenal            → 404 TENANT_NOT_FOUND
 * - status draft tanpa preview       → 404 TENANT_NOT_FOUND (situs belum di-publish)
 * - status suspended tanpa preview   → 410 TENANT_SUSPENDED
 * - ?preview=1 → draft/suspended bisa diakses (validasi sesi owner menyusul
 *   di Fase 7a saat auth ada; backend nyata yang menegakkannya).
 *
 * Modul ini sengaja bebas dependensi Nitro/h3 supaya bisa diuji unit murni.
 */
import { z } from "zod";
import {
  renderPageResponseSchema,
  renderTenantResponseSchema,
  type RenderPageResponse,
  type RenderTenantResponse,
} from "@marketplaceindo/shared";
import demo from "./fixtures/demo.json";
import otojaya from "./fixtures/otojaya.json";
import rintisan from "./fixtures/rintisan.json";
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
});
export type TenantFixture = z.infer<typeof tenantFixtureSchema>;

export const RAW_FIXTURES: Record<string, unknown> = {
  demo,
  otojaya,
  rintisan,
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

function findFixture(subdomain: string): TenantFixture {
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
  const fixture = findFixture(subdomain);
  assertAccessible(fixture.site, preview);
  return fixture.site;
}

/** Mock GET /v1/render/:subdomain/pages/:pageSlug */
export function getMockPage(
  subdomain: string,
  pageSlug: string,
  preview = false,
): RenderPageResponse {
  const fixture = findFixture(subdomain);
  assertAccessible(fixture.site, preview);
  const page = fixture.pages[pageSlug];
  if (!page) {
    throw new RenderApiError(404, "NOT_FOUND", "Halaman tidak ditemukan");
  }
  return page;
}
