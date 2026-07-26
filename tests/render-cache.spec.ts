/**
 * Fase 8 — kunci cache ISR & pencocokannya untuk revalidate (kontrak §11).
 * Yang dijaga di sini: satu tenant tidak pernah ikut ter-purge (atau tersaji)
 * karena namanya menjadi awalan nama tenant lain.
 */
import { describe, expect, it } from "vitest";
import { isCacheKeyOfTenant } from "../server/utils/render-cache-key";

const siteKey = (sub: string) => `tenant:render-site:${sub}.json`;
const pageKey = (sub: string, slug: string) => `tenant:render-page:${sub}__${slug}.json`;

describe("pencocokan kunci cache per tenant", () => {
  it("kunci site & page milik tenant yang sama ikut ter-purge", () => {
    expect(isCacheKeyOfTenant(siteKey("warung"), "warung")).toBe(true);
    expect(isCacheKeyOfTenant(pageKey("warung", "home"), "warung")).toBe(true);
    expect(isCacheKeyOfTenant(pageKey("warung", "menu"), "warung")).toBe(true);
  });

  it("tenant lain tidak ikut ter-purge", () => {
    expect(isCacheKeyOfTenant(siteKey("otojaya"), "warung")).toBe(false);
    expect(isCacheKeyOfTenant(pageKey("otojaya", "home"), "warung")).toBe(false);
  });

  it("nama tenant yang jadi AWALAN tenant lain tidak ikut ter-purge", () => {
    // Inti pemisah `__`: `warung-budi` bukan bagian dari purge `warung`.
    expect(isCacheKeyOfTenant(siteKey("warung-budi"), "warung")).toBe(false);
    expect(isCacheKeyOfTenant(pageKey("warung-budi", "home"), "warung")).toBe(false);

    // …dan sebaliknya tetap cocok untuk pemiliknya sendiri.
    expect(isCacheKeyOfTenant(siteKey("warung-budi"), "warung-budi")).toBe(true);
    expect(isCacheKeyOfTenant(pageKey("warung-budi", "home"), "warung-budi")).toBe(true);
  });

  it("subdomain yang jadi akhiran tenant lain juga tidak ikut", () => {
    expect(isCacheKeyOfTenant(siteKey("toko-budi"), "budi")).toBe(false);
  });
});
