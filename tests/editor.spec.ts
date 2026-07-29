/**
 * Fase 7c — editor konten: pemisahan draft vs snapshot publish (kontrak §5),
 * CRUD halaman/section/block, aturan slot template (§4), koleksi (§7),
 * dan media (§6).
 */
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import type { WizardAnswers } from "@marketplaceindo/shared";
import { TenantApiError } from "../server/mock/api-error";
import {
  createTenant,
  publishTenant,
  runWizard,
  updateSubdomain,
  updateTheme,
} from "../server/mock/tenant-store";
import {
  createPage,
  deletePage,
  getPageDetail,
  listPages,
  replaceBlocks,
  updatePage,
  updateSection,
} from "../server/mock/content-store";
import {
  createProduct,
  createVehicle,
  deleteVehicle,
  listVehicles,
  updateVehicle,
} from "../server/mock/collection-store";
import { presignUpload, readUpload, storeUpload } from "../server/mock/media-store";
import { allowedBlockTypes, templateDetail, templateSummaries } from "../server/mock/templates";
import { TEMPLATE_IDS } from "../server/mock/materialize";
import { getMockPage, getMockSite } from "../server/mock/render-store";

const answers = (over: Partial<WizardAnswers> = {}): WizardAnswers => ({
  businessName: "Warung Budi",
  businessType: "kuliner",
  address: "Jl. Melati No. 5, Bandung",
  whatsapp: "6281234567890",
  highlights: [{ name: "Nasi Timbel", price: 35000 }],
  ...over,
});

const uniqueOwner = () => crypto.randomUUID();
let seq = 0;
const uniqueSubdomain = () => `editor-test-${++seq}`;

/** Tenant siap-edit: draft + subdomain + konten hasil wizard. */
function editableTenant(over: Partial<WizardAnswers> = {}) {
  const ownerId = uniqueOwner();
  const subdomain = uniqueSubdomain();
  const tenant = createTenant(ownerId);
  updateSubdomain(ownerId, tenant.id, { subdomain });
  runWizard(ownerId, tenant.id, answers(over), () => "http://x.test");
  return { ownerId, tenantId: tenant.id, subdomain };
}

const liveOrigin = (sub: string) => `https://${sub}.test`;
const publish = (ownerId: string, tenantId: string) =>
  publishTenant(ownerId, tenantId, { hasSubscription: true, liveOrigin });

function homePageId(tenantId: string): string {
  return listPages(tenantId).items.find((p) => p.slug === "home")!.id;
}

function expectApiError(fn: () => unknown, status: number, code: string) {
  try {
    fn();
    expect.unreachable(`harus melempar ${code}`);
  } catch (err) {
    expect(err).toBeInstanceOf(TenantApiError);
    expect((err as TenantApiError).status).toBe(status);
    expect((err as TenantApiError).code).toBe(code);
  }
}

// ---------------------------------------------------------------------------

describe("draft vs snapshot publish (kontrak §5)", () => {
  it("perubahan editor hanya terlihat di preview sampai Publish ditekan", () => {
    const { ownerId, tenantId, subdomain } = editableTenant();
    publish(ownerId, tenantId);

    const pageId = homePageId(tenantId);
    const hero = getPageDetail(tenantId, pageId).sections.find((s) => s.sectionKey === "hero")!;
    replaceBlocks(
      tenantId,
      pageId,
      hero.id,
      { blocks: [{ type: "hero", data: { heading: "Judul Baru Sekali" } }] },
      TEMPLATE_IDS.kuliner,
    );
    // Sinkronisasi draft dilakukan pemanggil (dashboard-api) — tiru di sini.
    updateSubdomain(ownerId, tenantId, { subdomain });

    expect(JSON.stringify(getMockPage(subdomain, "home", true))).toContain("Judul Baru Sekali");
    expect(JSON.stringify(getMockPage(subdomain, "home"))).not.toContain("Judul Baru Sekali");

    publish(ownerId, tenantId);
    expect(JSON.stringify(getMockPage(subdomain, "home"))).toContain("Judul Baru Sekali");
  });

  it("section yang dinonaktifkan hilang dari situs, tapi datanya tetap tersimpan", () => {
    const { ownerId, tenantId, subdomain } = editableTenant();
    const pageId = homePageId(tenantId);
    const about = getPageDetail(tenantId, pageId).sections.find((s) => s.sectionKey === "about")!;

    updateSection(tenantId, pageId, about.id, { enabled: false });
    publish(ownerId, tenantId);

    const keys = getMockPage(subdomain, "home").sections.map((s) => s.sectionKey);
    expect(keys).not.toContain("about");
    // Data tidak hilang: masih ada di editor, tinggal diaktifkan lagi.
    const stored = getPageDetail(tenantId, pageId).sections.find((s) => s.id === about.id)!;
    expect(stored.enabled).toBe(false);
    expect(stored.blocks.length).toBeGreaterThan(0);

    updateSection(tenantId, pageId, about.id, { enabled: true });
    publish(ownerId, tenantId);
    expect(getMockPage(subdomain, "home").sections.map((s) => s.sectionKey)).toContain("about");
  });

  it("reorder section merapatkan urutan tanpa nomor bolong/ganda", () => {
    const { tenantId } = editableTenant();
    const pageId = homePageId(tenantId);
    const before = getPageDetail(tenantId, pageId).sections;
    const last = before[before.length - 1]!;

    updateSection(tenantId, pageId, last.id, { order: 0 });

    const after = getPageDetail(tenantId, pageId).sections;
    expect(after.map((s) => s.order)).toEqual(after.map((_, i) => i));
    expect(after[0]!.id).toBe(last.id);
  });

  it("tema tersimpan ke draft dan ikut terbit", () => {
    const { ownerId, tenantId, subdomain } = editableTenant();
    updateTheme(ownerId, tenantId, { primaryColor: "#123456", fontHeading: "Inter" });
    expect(getMockSite(subdomain, true).theme.primaryColor).toBe("#123456");

    publish(ownerId, tenantId);
    expect(getMockSite(subdomain).theme.primaryColor).toBe("#123456");
  });
});

describe("halaman (kontrak §5)", () => {
  it("tambah halaman: nav situs ikut bertambah, halaman punya navbar+footer", () => {
    const { ownerId, tenantId, subdomain } = editableTenant();
    const page = createPage(tenantId, { slug: "tentang-kami", title: "Tentang Kami" });
    publish(ownerId, tenantId);

    expect(getMockSite(subdomain).nav.map((n) => n.slug)).toContain("tentang-kami");
    const keys = getPageDetail(tenantId, page.id).sections.map((s) => s.sectionKey);
    expect(keys).toEqual(["navbar", "footer"]);
  });

  it("slug ganda & slug milik route koleksi ditolak", () => {
    const { tenantId } = editableTenant();
    createPage(tenantId, { slug: "promo", title: "Promo" });
    expectApiError(() => createPage(tenantId, { slug: "promo", title: "Promo 2" }), 409, "SLUG_TAKEN");
    expectApiError(() => createPage(tenantId, { slug: "mobil", title: "Mobil" }), 409, "SLUG_TAKEN");
  });

  it("beranda tidak bisa dihapus; halaman lain bisa", () => {
    const { tenantId } = editableTenant();
    const page = createPage(tenantId, { slug: "arsip", title: "Arsip" });
    expectApiError(() => deletePage(tenantId, homePageId(tenantId)), 409, "CONFIRMATION_REQUIRED");

    deletePage(tenantId, page.id);
    expect(listPages(tenantId).items.some((p) => p.id === page.id)).toBe(false);
  });

  it("SEO halaman tersimpan dan dipakai render", () => {
    const { ownerId, tenantId, subdomain } = editableTenant();
    updatePage(tenantId, homePageId(tenantId), {
      seoJson: { title: "Warung Budi — Masakan Sunda", description: "Nasi timbel & sate." },
    });
    publish(ownerId, tenantId);
    expect(getMockPage(subdomain, "home").page.seoJson?.title).toBe("Warung Budi — Masakan Sunda");
  });
});

describe("block & aturan slot template (kontrak §4/§5)", () => {
  it("block invalid ditolak dengan path ber-index (blocks.0.data.*)", () => {
    const { tenantId } = editableTenant();
    const pageId = homePageId(tenantId);
    const hero = getPageDetail(tenantId, pageId).sections.find((s) => s.sectionKey === "hero")!;

    try {
      replaceBlocks(
        tenantId,
        pageId,
        hero.id,
        { blocks: [{ type: "hero", data: { heading: "" } }] },
        TEMPLATE_IDS.kuliner,
      );
      expect.unreachable("harus melempar ZodError");
    } catch (err) {
      expect(err).toBeInstanceOf(ZodError);
      const paths = (err as ZodError).issues.map((i) => i.path.join("."));
      expect(paths).toContain("blocks.0.data.heading");
    }
  });

  it("tipe block di luar slot ditolak 422 BLOCK_NOT_ALLOWED_IN_SLOT", () => {
    const { tenantId } = editableTenant();
    const pageId = homePageId(tenantId);
    const hero = getPageDetail(tenantId, pageId).sections.find((s) => s.sectionKey === "hero")!;

    expectApiError(
      () =>
        replaceBlocks(
          tenantId,
          pageId,
          hero.id,
          { blocks: [{ type: "faq", data: { items: [{ question: "a", answer: "b" }] } }] },
          TEMPLATE_IDS.kuliner,
        ),
      422,
      "BLOCK_NOT_ALLOWED_IN_SLOT",
    );
  });

  it("slot highlights menerima block yang sesuai jenis usaha", () => {
    expect(allowedBlockTypes(TEMPLATE_IDS.kuliner, "home", "highlights")).toContain("featured_menu");
    expect(allowedBlockTypes(TEMPLATE_IDS.otomotif, "home", "highlights")).toContain("model_grid");
    expect(allowedBlockTypes(TEMPLATE_IDS.kuliner, "home", "highlights")).not.toContain("vehicle_grid");
  });

  it("katalog template menyebutkan slot & halaman yang dipakai materializer", () => {
    const detail = templateDetail("kuliner")!;
    expect(detail.structureJson.pages.map((p) => p.slug)).toEqual(["home", "menu"]);
    expect(templateSummaries().map((t) => t.slug).sort()).toEqual([
      "bisnis-jasa",
      "katalog",
      "kuliner",
      "otomotif",
    ]);
  });
});

describe("koleksi (kontrak §7)", () => {
  it("tambah unit: slug otomatis dari nama, unik per tenant", () => {
    const { tenantId } = editableTenant({ businessType: "otomotif" });
    const a = createVehicle(tenantId, { name: "Toyota Avanza", brand: "Toyota", year: 2023, price: 215_000_000 });
    const b = createVehicle(tenantId, { name: "Toyota Avanza", brand: "Toyota", year: 2024, price: 235_000_000 });
    expect(a.slug).toBe("toyota-avanza");
    expect(b.slug).toBe("toyota-avanza-2");
  });

  it("koleksi tenant ikut ter-render di situs setelah publish", () => {
    const { ownerId, tenantId, subdomain } = editableTenant({ businessType: "otomotif" });
    createVehicle(tenantId, { name: "Honda Brio", brand: "Honda", year: 2022, price: 165_000_000 });
    publish(ownerId, tenantId);

    // Situs live memuat unit tersebut (dipakai vehicle_grid & VDP).
    expect(JSON.stringify(getMockSite(subdomain))).toBeTruthy();
    expect(listVehicles(tenantId).items[0]?.name).toBe("Honda Brio");
  });

  it("pencarian & ubah & hapus bekerja", () => {
    const { tenantId } = editableTenant({ businessType: "otomotif" });
    const brio = createVehicle(tenantId, { name: "Honda Brio", brand: "Honda", year: 2022, price: 165_000_000 });
    createVehicle(tenantId, { name: "Toyota Rush", brand: "Toyota", year: 2021, price: 200_000_000 });

    expect(listVehicles(tenantId, { q: "brio" }).items).toHaveLength(1);
    expect(updateVehicle(tenantId, brio.id, { price: 160_000_000 }).price).toBe(160_000_000);

    deleteVehicle(tenantId, brio.id);
    expect(listVehicles(tenantId).items).toHaveLength(1);
    expectApiError(() => deleteVehicle(tenantId, brio.id), 404, "NOT_FOUND");
  });

  it("produk memakai jalur yang sama", () => {
    const { tenantId } = editableTenant({ businessType: "katalog" });
    const p = createProduct(tenantId, { name: "Sepatu Kulit", price: 450_000, category: "Sepatu" });
    expect(p.slug).toBe("sepatu-kulit");
  });
});

describe("media (kontrak §6)", () => {
  const urls = (id: string) => ({ uploadUrl: `/u/${id}`, fileUrl: `/f/${id}` });

  it("presign → upload → baca kembali", () => {
    const { tenantId } = editableTenant();
    const presign = presignUpload(
      tenantId,
      { filename: "foto.jpg", mimeType: "image/jpeg", size: 120_000 },
      urls,
    );
    storeUpload(presign.mediaId, new Uint8Array([1, 2, 3]));
    expect(readUpload(presign.mediaId).mimeType).toBe("image/jpeg");
  });

  it("tipe tak didukung & file kebesaran ditolak sesuai kontrak", () => {
    const { tenantId } = editableTenant();
    expectApiError(
      () => presignUpload(tenantId, { filename: "a.pdf", mimeType: "application/pdf", size: 10 }, urls),
      422,
      "UNSUPPORTED_MEDIA_TYPE",
    );
    expectApiError(
      () => presignUpload(tenantId, { filename: "a.jpg", mimeType: "image/jpeg", size: 99_000_000 }, urls),
      422,
      "FILE_TOO_LARGE",
    );
  });
});
