/**
 * Fase 1 — mock render API: fixture valid terhadap schema shared + semantik
 * akses per status tenant (kontrak §10).
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  renderPageResponseSchema,
  renderTenantResponseSchema,
} from "@marketplaceindo/shared";
import {
  RAW_FIXTURES,
  RenderApiError,
  getMockPage,
  getMockSite,
} from "../server/mock/render-store";

const fixtureSchema = z.object({
  site: renderTenantResponseSchema,
  pages: z.record(z.string(), renderPageResponseSchema),
});

describe("fixture mock render", () => {
  it.each(Object.keys(RAW_FIXTURES))("fixture %s lolos schema shared", (name) => {
    const result = fixtureSchema.safeParse(RAW_FIXTURES[name]);
    expect(result.success, result.success ? "" : z.prettifyError(result.error)).toBe(true);
  });

  it("dua tenant aktif punya konten berbeda (DoD Fase 1)", () => {
    const demo = getMockPage("demo", "home");
    const oto = getMockPage("otojaya", "home");
    expect(JSON.stringify(demo)).not.toBe(JSON.stringify(oto));
    expect(getMockSite("demo").theme).not.toEqual(getMockSite("otojaya").theme);
  });
});

function expectRenderError(fn: () => unknown, status: number, code: string) {
  try {
    fn();
    expect.unreachable("harus melempar RenderApiError");
  } catch (err) {
    expect(err).toBeInstanceOf(RenderApiError);
    const e = err as RenderApiError;
    expect(e.status).toBe(status);
    expect(e.code).toBe(code);
  }
}

describe("semantik akses per status tenant", () => {
  it("subdomain tak dikenal → 404 TENANT_NOT_FOUND", () => {
    expectRenderError(() => getMockSite("tidakada"), 404, "TENANT_NOT_FOUND");
  });

  it("tenant aktif → bisa diakses tanpa preview", () => {
    expect(getMockSite("demo").tenant.status).toBe("active");
    expect(getMockPage("demo", "home").page.slug).toBe("home");
  });

  it("draft tanpa preview → 404 (situs belum publish, tidak boleh terlihat ada)", () => {
    expectRenderError(() => getMockSite("rintisan"), 404, "TENANT_NOT_FOUND");
    expectRenderError(() => getMockPage("rintisan", "home"), 404, "TENANT_NOT_FOUND");
  });

  it("draft dengan preview=true → bisa diakses", () => {
    expect(getMockSite("rintisan", true).tenant.status).toBe("draft");
    expect(getMockPage("rintisan", "home", true).sections.length).toBeGreaterThan(0);
  });

  it("suspended tanpa preview → 410 TENANT_SUSPENDED", () => {
    expectRenderError(() => getMockSite("tutupsementara"), 410, "TENANT_SUSPENDED");
    expectRenderError(() => getMockPage("tutupsementara", "home"), 410, "TENANT_SUSPENDED");
  });

  it("suspended dengan preview → bisa diakses (owner melihat situsnya)", () => {
    expect(getMockSite("tutupsementara", true).tenant.status).toBe("suspended");
  });

  it("halaman tak dikenal pada tenant aktif → 404 NOT_FOUND", () => {
    expectRenderError(() => getMockPage("demo", "tidak-ada"), 404, "NOT_FOUND");
  });
});
