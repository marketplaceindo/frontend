/**
 * Fase 4 — koleksi mock (filter kontrak §7) + lead store (§8).
 */
import { describe, expect, it } from "vitest";
import {
  RenderApiError,
  createMockLead,
  getMockProduct,
  getMockProducts,
  getMockSitemap,
  getMockUnit,
  getMockUnits,
  mockLeads,
} from "../server/mock/render-store";

describe("getMockUnits (otojaya)", () => {
  it("default: semua unit, urut terbaru dulu", () => {
    const r = getMockUnits("otojaya");
    expect(r.items).toHaveLength(5);
    expect(r.items[0]!.slug).toBe("suzuki-ertiga-2019"); // createdAt terbaru
    expect(r.nextCursor).toBeNull();
  });

  it("filter brand, harga, tahun, transmisi, q", () => {
    expect(getMockUnits("otojaya", { brand: "toyota" }).items).toHaveLength(2);
    expect(getMockUnits("otojaya", { priceMax: "200000000" }).items).toHaveLength(3);
    expect(getMockUnits("otojaya", { year: "2023" }).items[0]!.slug).toBe("honda-brio-2023");
    expect(getMockUnits("otojaya", { transmission: "manual" }).items).toHaveLength(2);
    expect(getMockUnits("otojaya", { q: "innova" }).items).toHaveLength(1);
  });

  it("pagination cursor: limit 2 → 2+2+1", () => {
    const p1 = getMockUnits("otojaya", { limit: "2" });
    expect(p1.items).toHaveLength(2);
    expect(p1.nextCursor).toBe("2");
    const p2 = getMockUnits("otojaya", { limit: "2", cursor: p1.nextCursor! });
    expect(p2.items).toHaveLength(2);
    const p3 = getMockUnits("otojaya", { limit: "2", cursor: p2.nextCursor! });
    expect(p3.items).toHaveLength(1);
    expect(p3.nextCursor).toBeNull();
  });

  it("tenant tanpa koleksi → kosong; subdomain asing → 404", () => {
    expect(getMockUnits("demo").items).toHaveLength(0);
    expect(() => getMockUnits("tidakada")).toThrow(RenderApiError);
  });
});

describe("getMockProducts (tokoberkah)", () => {
  it("filter kategori & harga", () => {
    expect(getMockProducts("tokoberkah", { category: "Kopi" }).items).toHaveLength(2);
    expect(getMockProducts("tokoberkah", { priceMin: "50000" }).items).toHaveLength(3);
    expect(getMockProducts("tokoberkah", { q: "madu" }).items[0]!.slug).toBe("madu-hutan-500ml");
  });
});

describe("item getter VDP/PDP (Fase 5)", () => {
  it("getMockUnit: slug dikenal → item penuh; asing → 404 NOT_FOUND", () => {
    const v = getMockUnit("otojaya", "honda-brio-2023");
    expect(v.name).toBe("Honda Brio RS");
    expect(v.description).toContain("garansi pabrik");
    try {
      getMockUnit("otojaya", "tidak-ada");
      expect.unreachable();
    } catch (err) {
      expect((err as RenderApiError).status).toBe(404);
      expect((err as RenderApiError).code).toBe("NOT_FOUND");
    }
  });

  it("getMockProduct: slug dikenal → item penuh; asing → 404", () => {
    expect(getMockProduct("tokoberkah", "madu-hutan-500ml").price).toBe(120000);
    expect(() => getMockProduct("tokoberkah", "tidak-ada")).toThrow(RenderApiError);
  });

  it("status tenant tetap ditegakkan di item getter (draft → 404 tanpa preview)", () => {
    expect(() => getMockUnit("rintisan", "apapun")).toThrow(RenderApiError);
  });
});

describe("getMockSitemap (Fase 6)", () => {
  it("otojaya: memuat halaman model DAN tiap varian (addendum §Fase 6)", () => {
    const paths = getMockSitemap("otojaya").urls.map((u) => u.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/mobil");
    // Halaman model punya nilai SEO sendiri ("harga xpander" ≫ "harga xpander ultimate"),
    // jadi keduanya wajib masuk sitemap — bukan hanya varian.
    expect(paths).toContain("/mobil/xpander");
    expect(paths).toContain("/mobil/xpander/ultimate-cvt");
    expect(paths).toContain("/mobil-bekas");
    expect(paths).toContain("/mobil-bekas/honda-brio-2023");
    expect(paths).not.toContain("/produk");
  });

  it("tokoberkah: memuat /produk + PDP, tidak memuat /mobil", () => {
    const paths = getMockSitemap("tokoberkah").urls.map((u) => u.path);
    expect(paths).toContain("/produk/kopi-arabika-gayo-250g");
    expect(paths).not.toContain("/mobil");
  });

  it("dua tenant berbeda menghasilkan daftar URL berbeda (DoD Fase 6)", () => {
    const a = getMockSitemap("otojaya").urls.map((u) => u.path).sort();
    const b = getMockSitemap("tokoberkah").urls.map((u) => u.path).sort();
    expect(a).not.toEqual(b);
  });

  it("tenant draft/suspended tanpa preview → error (tak ada sitemap publik)", () => {
    expect(() => getMockSitemap("rintisan")).toThrow(RenderApiError);
    expect(() => getMockSitemap("tutupsementara")).toThrow(RenderApiError);
  });
});

describe("createMockLead", () => {
  it("tenant aktif → lead tersimpan dengan id uuid", () => {
    const before = mockLeads.length;
    const r = createMockLead("otojaya", {
      source: "test_drive",
      nama: "Budi",
      telepon: "081234567890",
      refType: "unit",
      refSlug: "honda-brio-2023",
      refLabel: "Honda Brio 2023",
      meta: { tanggal: "2026-07-20" },
    });
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
    // Backend yang menyusun teks WA supaya format pesan konsisten (§5).
    expect(r.waDeepLink).toContain("wa.me/");
    expect(decodeURIComponent(r.waDeepLink)).toContain("Honda Brio 2023");
    expect(mockLeads).toHaveLength(before + 1);
    expect(mockLeads.at(-1)!.subdomain).toBe("otojaya");
  });

  it("tenant draft → 409 TENANT_NOT_ACTIVE; asing → 404", () => {
    try {
      createMockLead("rintisan", { source: "contact", nama: "Ani", telepon: "081234567890" });
      expect.unreachable();
    } catch (err) {
      expect((err as RenderApiError).status).toBe(409);
      expect((err as RenderApiError).code).toBe("TENANT_NOT_ACTIVE");
    }
    expect(() =>
      createMockLead("tidakada", { source: "contact", nama: "Ani", telepon: "081234567890" }),
    ).toThrow(RenderApiError);
  });
});
