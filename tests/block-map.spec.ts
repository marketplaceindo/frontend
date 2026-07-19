/**
 * Fase 3–4 — blockMap: 12 tipe inti + section khas template + block fungsional.
 * Tipe asing → BlockUnknown (forward compatibility).
 */
import { describe, expect, it } from "vitest";
import { BLOCK_TYPES } from "@marketplaceindo/shared";
import {
  BlockUnknown,
  CORE_BLOCK_TYPES,
  blockMap,
  resolveBlock,
} from "../app/utils/block-map";
import { RAW_FIXTURES } from "../server/mock/render-store";

describe("blockMap", () => {
  it("12 tipe inti semuanya terdaftar dan valid sebagai tipe block shared", () => {
    expect(CORE_BLOCK_TYPES).toHaveLength(12);
    for (const type of CORE_BLOCK_TYPES) {
      expect(BLOCK_TYPES).toContain(type);
      expect(resolveBlock(type)).not.toBe(BlockUnknown);
    }
  });

  it("Fase 4: SEMUA tipe block shared punya komponen", () => {
    for (const type of BLOCK_TYPES) {
      expect(blockMap[type], `blockMap["${type}"] belum ada`).toBeTruthy();
      expect(resolveBlock(type)).not.toBe(BlockUnknown);
    }
  });

  it("tipe asing → BlockUnknown, bukan crash", () => {
    expect(resolveBlock("tipe_masa_depan")).toBe(BlockUnknown);
  });

  it("fixture lengkap memuat semua 12 tipe inti + 4 tipe bisnis_jasa", () => {
    const fixture = RAW_FIXTURES.lengkap as {
      pages: { home: { sections: { blocks: { type: string }[] }[] } };
    };
    const types = new Set(
      fixture.pages.home.sections.flatMap((s) => s.blocks.map((b) => b.type)),
    );
    for (const t of [...CORE_BLOCK_TYPES, "services", "process", "team", "client_logos"]) {
      expect(types.has(t), `lengkap tidak memuat "${t}"`).toBe(true);
    }
  });
});
