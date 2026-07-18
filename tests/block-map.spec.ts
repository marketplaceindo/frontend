/**
 * Fase 3 — blockMap: 12 tipe section inti terpetakan ke komponen;
 * tipe tak dikenal jatuh ke BlockUnknown (forward compatibility).
 */
import { describe, expect, it } from "vitest";
import { BLOCK_TYPES } from "@marketplaceindo/shared";
import {
  BlockUnknown,
  CORE_BLOCK_TYPES,
  blockMap,
  resolveBlock,
} from "../app/utils/block-map";

describe("blockMap Fase 3", () => {
  it("12 tipe inti semuanya terdaftar dan valid sebagai tipe block shared", () => {
    expect(CORE_BLOCK_TYPES).toHaveLength(12);
    for (const type of CORE_BLOCK_TYPES) {
      expect(BLOCK_TYPES).toContain(type);
      expect(blockMap[type], `blockMap["${type}"] belum ada`).toBeTruthy();
      expect(resolveBlock(type)).not.toBe(BlockUnknown);
    }
  });

  it("tipe di luar inti (Fase 4) & tipe asing → BlockUnknown, bukan crash", () => {
    expect(resolveBlock("vehicle_grid")).toBe(BlockUnknown);
    expect(resolveBlock("tipe_masa_depan")).toBe(BlockUnknown);
  });

  it("fixture lengkap memakai tepat 12 tipe inti", async () => {
    const { RAW_FIXTURES } = await import("../server/mock/render-store");
    const fixture = RAW_FIXTURES.lengkap as {
      pages: { home: { sections: { blocks: { type: string }[] }[] } };
    };
    const types = fixture.pages.home.sections.flatMap((s) =>
      s.blocks.map((b) => b.type),
    );
    expect(types.sort()).toEqual([...CORE_BLOCK_TYPES].sort());
  });
});
