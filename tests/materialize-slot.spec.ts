/**
 * Invarian antara materializer wizard dan slot template.
 *
 * Dua bug nyata yang ditangkap file ini:
 *
 * 1. Block yang ditaruh `materialize.ts` ke sebuah slot HARUS diizinkan
 *    `templates.ts` untuk slot itu. Kalau tidak, situs tetap ter-render (karena
 *    materialisasi tidak lewat validasi slot) tapi begitu user membuka editor
 *    dan menekan Simpan, ia kena `422 BLOCK_NOT_ALLOWED_IN_SLOT` untuk konten
 *    yang dibuat sistem sendiri — dan tidak ada jalan keluar dari UI.
 *
 * 2. Model kendaraan baru (hasil seed katalog maupun input manual) harus ikut
 *    ke dalam fixture render, kalau tidak halaman /mobil tenant kosong meski
 *    datanya ada di dashboard.
 */
import { describe, expect, it } from "vitest";
import { BUSINESS_TYPES, type WizardAnswers } from "@marketplaceindo/shared";
import { materializeWizard, templateIdForBusinessType } from "../server/mock/materialize";
import { allowedBlockTypes } from "../server/mock/templates";
import { contentToFixture, seedContentFromFixture } from "../server/mock/content-store";
import { createVehicleModel, resetModels } from "../server/mock/vehicle-model-store";
import { createVehicle as createVehicleUnit } from "../server/mock/collection-store";

function answersFor(type: WizardAnswers["businessType"]): WizardAnswers {
  return {
    businessName: "Uji Coba",
    businessType: type,
    address: "Jl. Uji No. 1, Jakarta",
    whatsapp: "6281234567890",
    openingHours: [{ days: "Senin–Sabtu", open: "08:00", close: "21:00" }],
    highlights: [{ name: "Andalan A", price: 25000 }],
    tagline: "Tagline uji",
  };
}

describe("materialisasi selalu menghasilkan block yang diizinkan slotnya", () => {
  it.each(BUSINESS_TYPES)("jenis usaha %s", (type) => {
    const templateId = templateIdForBusinessType(type);
    const fixture = materializeWizard("contoh", answersFor(type));

    const pelanggaran: string[] = [];
    for (const [pageSlug, page] of Object.entries(fixture.pages)) {
      for (const section of page.sections) {
        const allowed = allowedBlockTypes(templateId, pageSlug, section.sectionKey);
        if (!allowed) continue; // slot tak dikenal template → tanpa batasan
        for (const block of section.blocks) {
          if (!allowed.includes(block.type)) {
            pelanggaran.push(
              `${pageSlug}/${section.sectionKey}: "${block.type}" tidak ada di [${allowed.join(", ")}]`,
            );
          }
        }
      }
    }

    expect(
      pelanggaran,
      `Konten hasil wizard tidak bisa disimpan ulang lewat editor:\n  ${pelanggaran.join("\n  ")}`,
    ).toEqual([]);
  });
});

describe("model kendaraan baru ikut ke fixture render", () => {
  const TENANT = "22222222-2222-4222-8222-222222222222";

  it("model yang dibuat dashboard muncul di fixture situs", () => {
    resetModels(TENANT);
    seedContentFromFixture(TENANT, materializeWizard("dealer", answersFor("otomotif")));

    createVehicleModel(TENANT, {
      vertical: "mobil",
      brand: "BYD",
      name: "Atto 3",
      modelYear: 2026,
      bodyType: "suv",
      images: [{ url: "https://cdn.test/atto3.jpg", alt: "Atto 3" }],
      summary: "SUV listrik kompak.",
      isPublished: true,
      variants: [
        {
          name: "Superior",
          trimRank: 0,
          priceOtr: [{ cityCode: "JKT", cityName: "Jakarta", price: 515_000_000 }],
        },
      ],
    });

    const fixture = contentToFixture(TENANT, {
      subdomain: "dealer",
      status: "active",
      publishedAt: "2026-08-01T00:00:00Z",
      theme: {},
    });

    expect(fixture.models ?? []).toHaveLength(1);
    expect(fixture.models?.[0]?.name).toBe("Atto 3");
  });

  it("unit bekas memakai kunci `units` yang dikenali schema fixture", () => {
    // Zod membuang kunci asing tanpa bersuara: `vehicles` pernah lolos typecheck
    // tapi membuat seluruh unit bekas hilang dari situs.
    resetModels(TENANT);
    seedContentFromFixture(TENANT, materializeWizard("dealer", answersFor("otomotif")));
    createVehicleUnit(TENANT, {
      name: "Avanza 2019",
      brand: "Toyota",
      year: 2019,
      price: 165_000_000,
    });

    const fixture = contentToFixture(TENANT, {
      subdomain: "dealer",
      status: "active",
      publishedAt: "2026-08-01T00:00:00Z",
      theme: {},
    });

    expect(fixture.units ?? []).toHaveLength(1);
    expect((fixture as Record<string, unknown>).vehicles).toBeUndefined();
  });
});
