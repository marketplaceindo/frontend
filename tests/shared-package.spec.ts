/**
 * Smoke test Fase 0 — memastikan @marketplaceindo/shared terpasang dan berfungsi.
 * Bukan test schema (itu tanggung jawab repo shared); hanya bukti konsumsi.
 */
import { describe, expect, it } from "vitest";
import {
  PACKAGE_NAME,
  PLANS,
  blockSchema,
  isReservedSubdomain,
  type Block,
} from "@marketplaceindo/shared";

describe("konsumsi @marketplaceindo/shared", () => {
  it("blockSchema menerima payload valid dan tipe Block ter-infer", () => {
    const hero: Block = {
      type: "hero",
      data: {
        heading: "Bengkel Maju Jaya",
        subheading: "Servis mobil terpercaya sejak 1998",
        align: "center",
      },
    };
    const result = blockSchema.safeParse(hero);
    expect(result.success).toBe(true);
  });

  it("blockSchema menolak payload invalid", () => {
    const invalid = { type: "hero", data: { subheading: 123 } };
    const result = blockSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("blockSchema menolak type yang tidak dikenal", () => {
    const result = blockSchema.safeParse({ type: "tidak_ada", data: {} });
    expect(result.success).toBe(false);
  });

  it("konstanta & util ikut ter-ekspor", () => {
    expect(PACKAGE_NAME).toBe("@marketplaceindo/shared");
    expect(PLANS.yearly.price).toBe(300_000);
    expect(PLANS.yearly.hero).toBe(true);
    expect(isReservedSubdomain("www")).toBe(true);
  });
});
