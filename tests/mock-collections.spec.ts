/**
 * Fase 4 — koleksi mock (filter kontrak §7) + lead store (§8).
 */
import { describe, expect, it } from "vitest";
import {
  RenderApiError,
  createMockLead,
  getMockProducts,
  getMockVehicles,
  mockLeads,
} from "../server/mock/render-store";

describe("getMockVehicles (otojaya)", () => {
  it("default: semua unit, urut terbaru dulu", () => {
    const r = getMockVehicles("otojaya");
    expect(r.items).toHaveLength(5);
    expect(r.items[0]!.slug).toBe("suzuki-ertiga-2019"); // createdAt terbaru
    expect(r.nextCursor).toBeNull();
  });

  it("filter brand, harga, tahun, transmisi, q", () => {
    expect(getMockVehicles("otojaya", { brand: "toyota" }).items).toHaveLength(2);
    expect(getMockVehicles("otojaya", { priceMax: "200000000" }).items).toHaveLength(3);
    expect(getMockVehicles("otojaya", { year: "2023" }).items[0]!.slug).toBe("honda-brio-2023");
    expect(getMockVehicles("otojaya", { transmission: "manual" }).items).toHaveLength(2);
    expect(getMockVehicles("otojaya", { q: "innova" }).items).toHaveLength(1);
  });

  it("pagination cursor: limit 2 → 2+2+1", () => {
    const p1 = getMockVehicles("otojaya", { limit: "2" });
    expect(p1.items).toHaveLength(2);
    expect(p1.nextCursor).toBe("2");
    const p2 = getMockVehicles("otojaya", { limit: "2", cursor: p1.nextCursor! });
    expect(p2.items).toHaveLength(2);
    const p3 = getMockVehicles("otojaya", { limit: "2", cursor: p2.nextCursor! });
    expect(p3.items).toHaveLength(1);
    expect(p3.nextCursor).toBeNull();
  });

  it("tenant tanpa koleksi → kosong; subdomain asing → 404", () => {
    expect(getMockVehicles("demo").items).toHaveLength(0);
    expect(() => getMockVehicles("tidakada")).toThrow(RenderApiError);
  });
});

describe("getMockProducts (tokoberkah)", () => {
  it("filter kategori & harga", () => {
    expect(getMockProducts("tokoberkah", { category: "Kopi" }).items).toHaveLength(2);
    expect(getMockProducts("tokoberkah", { priceMin: "50000" }).items).toHaveLength(3);
    expect(getMockProducts("tokoberkah", { q: "madu" }).items[0]!.slug).toBe("madu-hutan-500ml");
  });
});

describe("createMockLead", () => {
  it("tenant aktif → lead tersimpan dengan id uuid", () => {
    const before = mockLeads.length;
    const r = createMockLead("otojaya", {
      type: "test_drive",
      payload: { name: "Budi", phone: "081234567890", date: "2026-07-20" },
      sourceItemSlug: "honda-brio-2023",
    });
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(mockLeads).toHaveLength(before + 1);
    expect(mockLeads.at(-1)!.subdomain).toBe("otojaya");
  });

  it("tenant draft → 409 TENANT_NOT_ACTIVE; asing → 404", () => {
    try {
      createMockLead("rintisan", { type: "contact", payload: { name: "A", phone: "0812345678" } });
      expect.unreachable();
    } catch (err) {
      expect((err as RenderApiError).status).toBe(409);
      expect((err as RenderApiError).code).toBe("TENANT_NOT_ACTIVE");
    }
    expect(() =>
      createMockLead("tidakada", { type: "contact", payload: { name: "A", phone: "0812345678" } }),
    ).toThrow(RenderApiError);
  });
});
