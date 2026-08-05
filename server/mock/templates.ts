/**
 * Katalog template (kontrak §4) — mock dari tabel `templates`. `structureJson`
 * mendeskripsikan slot per halaman: `sectionKey` mana yang ada dan tipe block
 * apa yang boleh mengisinya. Editor (Fase 7c) memakainya untuk membatasi
 * pilihan block, dan `PUT .../blocks` menolak tipe di luar daftar dengan
 * `422 BLOCK_NOT_ALLOWED_IN_SLOT`.
 *
 * Slot di sini SELARAS dengan section yang dihasilkan `materialize.ts` — kontrak
 * §5 tidak punya endpoint membuat section baru, jadi section yang tersedia bagi
 * user memang ditentukan template sejak materialisasi.
 *
 * Bebas dependensi Nitro/h3 → bisa diuji unit murni.
 */
import type {
  BlockType,
  BusinessType,
  TemplateDetailResponse,
  TemplateStructure,
  TemplateSummary,
} from "@marketplaceindo/shared";
import { TEMPLATE_IDS } from "./materialize";

/** Block yang boleh mengisi slot "highlights" per jenis usaha. */
/*
 * `services` WAJIB ada di setiap daftar non-kuliner: itulah block yang ditaruh
 * `materialize.ts` di slot "highlights" untuk 1–3 andalan hasil wizard. Kalau
 * dihapus dari sini, situs tetap ter-render tapi user kena
 * `422 BLOCK_NOT_ALLOWED_IN_SLOT` saat menyimpan konten yang dibuat sistem
 * sendiri — dan tidak ada jalan keluar dari UI. Dijaga tests/materialize-slot.
 */
const HIGHLIGHT_BLOCKS: Record<BusinessType, BlockType[]> = {
  kuliner: ["featured_menu", "menu"],
  katalog: ["services", "price_list", "product_grid", "product_categories"],
  bisnis_jasa: ["services", "features", "process"],
  otomotif: ["services", "model_grid", "unit_grid", "featured_vehicles", "variant_table"],
};

const TEMPLATE_NAMES: Record<BusinessType, { slug: string; name: string }> = {
  bisnis_jasa: { slug: "bisnis-jasa", name: "Bisnis & Jasa" },
  katalog: { slug: "katalog", name: "Katalog Produk" },
  kuliner: { slug: "kuliner", name: "Kuliner" },
  otomotif: { slug: "otomotif", name: "Sales & Otomotif" },
};

/**
 * Preview & demo tiap template. Mock memakai tenant fixture seed sebagai demo
 * yang bisa benar-benar dibuka; backend nyata mengisi dari kolom tabel.
 */
const TEMPLATE_SHOWCASE: Record<BusinessType, { previewImageUrl: string; demoUrl: string }> = {
  bisnis_jasa: {
    previewImageUrl: "https://marketindonesia.co.id/templates/bisnis-jasa.jpg",
    demoUrl: "https://lengkap.marketindonesia.co.id",
  },
  katalog: {
    previewImageUrl: "https://marketindonesia.co.id/templates/katalog.jpg",
    demoUrl: "https://tokoberkah.marketindonesia.co.id",
  },
  kuliner: {
    previewImageUrl: "https://marketindonesia.co.id/templates/kuliner.jpg",
    demoUrl: "https://demo.marketindonesia.co.id",
  },
  otomotif: {
    previewImageUrl: "https://marketindonesia.co.id/templates/otomotif.jpg",
    demoUrl: "https://otojaya.marketindonesia.co.id",
  },
};

function structureFor(type: BusinessType): TemplateStructure {
  const home = {
    slug: "home",
    title: "Beranda",
    sections: [
      { sectionKey: "navbar", allowedBlockTypes: ["navbar"] as BlockType[], required: true },
      { sectionKey: "hero", allowedBlockTypes: ["hero"] as BlockType[], required: true },
      { sectionKey: "highlights", allowedBlockTypes: HIGHLIGHT_BLOCKS[type] },
      { sectionKey: "about", allowedBlockTypes: ["about", "features"] as BlockType[] },
      { sectionKey: "opening_hours", allowedBlockTypes: ["opening_hours"] as BlockType[] },
      { sectionKey: "cta_band", allowedBlockTypes: ["cta_band", "promo_banner"] as BlockType[] },
      { sectionKey: "contact", allowedBlockTypes: ["contact"] as BlockType[] },
      {
        sectionKey: "footer",
        allowedBlockTypes: ["footer", "whatsapp_float"] as BlockType[],
        required: true,
      },
    ],
  };

  const pages = [home];
  if (type === "kuliner") {
    pages.push({
      slug: "menu",
      title: "Menu",
      sections: [
        { sectionKey: "navbar", allowedBlockTypes: ["navbar"] as BlockType[], required: true },
        { sectionKey: "menu", allowedBlockTypes: ["menu", "featured_menu"] as BlockType[] },
        {
          sectionKey: "footer",
          allowedBlockTypes: ["footer", "whatsapp_float"] as BlockType[],
          required: true,
        },
      ],
    });
  }
  return { pages };
}

const BUSINESS_TYPE_BY_SLUG = new Map<string, BusinessType>(
  Object.entries(TEMPLATE_NAMES).map(([type, t]) => [t.slug, type as BusinessType]),
);

export function templateSummaries(): TemplateSummary[] {
  return (Object.keys(TEMPLATE_NAMES) as BusinessType[]).map((type) => ({
    id: TEMPLATE_IDS[type],
    slug: TEMPLATE_NAMES[type].slug,
    name: TEMPLATE_NAMES[type].name,
    businessType: type,
    ...TEMPLATE_SHOWCASE[type],
  }));
}

export function templateDetail(slug: string): TemplateDetailResponse | null {
  const type = BUSINESS_TYPE_BY_SLUG.get(slug);
  if (!type) return null;
  return {
    id: TEMPLATE_IDS[type],
    slug: TEMPLATE_NAMES[type].slug,
    name: TEMPLATE_NAMES[type].name,
    businessType: type,
    ...TEMPLATE_SHOWCASE[type],
    structureJson: structureFor(type),
  };
}

export function structureForTemplateId(templateId: string): TemplateStructure | null {
  const entry = (Object.keys(TEMPLATE_IDS) as BusinessType[]).find(
    (t) => TEMPLATE_IDS[t] === templateId,
  );
  return entry ? structureFor(entry) : null;
}

/**
 * Tipe block yang diizinkan untuk satu slot. `null` = slot tak dikenal template
 * (mis. konten lama) → pemanggil membiarkannya lewat tanpa batasan slot.
 */
export function allowedBlockTypes(
  templateId: string | null,
  pageSlug: string,
  sectionKey: string,
): BlockType[] | null {
  if (!templateId) return null;
  const structure = structureForTemplateId(templateId);
  const page = structure?.pages.find((p) => p.slug === pageSlug);
  const slot = page?.sections.find((s) => s.sectionKey === sectionKey);
  return slot?.allowedBlockTypes ?? null;
}
