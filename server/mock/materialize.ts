/**
 * Materialisasi jawaban wizard → konten situs nyata (Fase 7b; kontrak §3
 * `POST /v1/tenants/:id/wizard`). Backend nyata membangun ini dari
 * `template.structure_json` + seed; mock menghasilkan bentuk yang identik dengan
 * fixture render (`TenantFixture`) supaya situs preview benar-benar ter-render
 * oleh renderer publik Fase 3–4 tanpa jalur khusus.
 *
 * Prinsip PLAN-FRONTEND §7b.4: **tidak ada lorem ipsum** — setiap teks
 * diturunkan dari jawaban user (nama usaha, alamat, WA, jam buka, andalan).
 *
 * Bebas dependensi Nitro/h3 → bisa diuji unit murni.
 */
import type {
  Block,
  BusinessType,
  MenuItem,
  RenderPageResponse,
  TenantStatus,
  TenantTheme,
  ThemePreset,
  WizardAnswers,
} from "@marketplaceindo/shared";
import { applyThemePreset } from "../../shared/utils/theme-presets";
import type { TenantFixture } from "./render-store";

type Section = RenderPageResponse["sections"][number];

interface Preset {
  /** Slug template — dikonsumsi SiteEntry (mis. "kuliner" → JSON-LD Restaurant). */
  templateSlug: string;
  /** ID template stabil per jenis usaha (backend nyata: baris tabel templates). */
  templateId: string;
  /** Sebutan usaha untuk kalimat "tentang kami". */
  noun: string;
  /** Judul section yang memuat 1–3 andalan dari wizard. */
  highlightHeading: string;
  /** Label CTA utama di hero. */
  ctaLabel: string;
  /** Pesan WhatsApp ter-prefill dari CTA hero. */
  waMessage: (businessName: string) => string;
  theme: TenantTheme;
}

/** ID template stabil (UUID v4) — mock berdiri untuk baris tabel `templates`. */
export const TEMPLATE_IDS: Record<BusinessType, string> = {
  bisnis_jasa: "b1a5f0c2-4d7e-4a1b-9c3d-0e1f2a3b4c5d",
  katalog: "c2b6a1d3-5e8f-4b2c-8d4e-1f2a3b4c5d6e",
  kuliner: "d3c7b2e4-6f9a-4c3d-9e5f-2a3b4c5d6e7f",
  otomotif: "e4d8c3f5-7a0b-4d4e-af60-3b4c5d6e7f80",
};

const PRESETS: Record<BusinessType, Preset> = {
  bisnis_jasa: {
    // Slug template mengikuti `slugSchema` shared (tanda hubung, bukan underscore).
    templateSlug: "bisnis-jasa",
    templateId: TEMPLATE_IDS.bisnis_jasa,
    noun: "penyedia jasa",
    highlightHeading: "Layanan Unggulan",
    ctaLabel: "Konsultasi via WhatsApp",
    waMessage: (n) => `Halo ${n}, saya ingin bertanya soal layanan Anda.`,
    theme: {
      primaryColor: "#1d4ed8",
      secondaryColor: "#0f172a",
      backgroundColor: "#ffffff",
      textColor: "#0f172a",
      fontHeading: "Poppins",
      fontBody: "Inter",
      radius: "md",
    },
  },
  katalog: {
    templateSlug: "katalog",
    templateId: TEMPLATE_IDS.katalog,
    noun: "toko",
    highlightHeading: "Produk Andalan",
    ctaLabel: "Pesan via WhatsApp",
    waMessage: (n) => `Halo ${n}, saya mau tanya produk yang tersedia.`,
    theme: {
      primaryColor: "#059669",
      secondaryColor: "#065f46",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      fontHeading: "Poppins",
      fontBody: "Inter",
      radius: "lg",
    },
  },
  kuliner: {
    templateSlug: "kuliner",
    templateId: TEMPLATE_IDS.kuliner,
    noun: "tempat makan",
    highlightHeading: "Menu Andalan",
    ctaLabel: "Pesan Sekarang",
    waMessage: (n) => `Halo ${n}, saya mau pesan makanan.`,
    theme: {
      primaryColor: "#c2410c",
      secondaryColor: "#7c2d12",
      backgroundColor: "#fffbf5",
      textColor: "#1c1917",
      fontHeading: "Poppins",
      fontBody: "Inter",
      radius: "md",
    },
  },
  otomotif: {
    templateSlug: "otomotif",
    templateId: TEMPLATE_IDS.otomotif,
    noun: "dealer",
    highlightHeading: "Unit Tersedia",
    ctaLabel: "Hubungi Sales",
    waMessage: (n) => `Halo ${n}, saya tertarik dengan unit yang tersedia.`,
    theme: {
      primaryColor: "#b91c1c",
      secondaryColor: "#111827",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      fontHeading: "Poppins",
      fontBody: "Inter",
      radius: "sm",
    },
  },
};

/**
 * Tema awal tenant: bawaan jenis usaha, ditimpa gaya yang dipilih tenant di
 * wizard bila ada.
 *
 * Preset menang penuh — termasuk warnanya — karena langkah wizard-nya
 * menampilkan mini-mockup berwarna palet itu. Menahan warnanya dan hanya
 * memakai lapisan bentuk akan membuat situs jadi berbeda dari yang barusan
 * dilihat tenant saat memilih.
 */
export function themeForBusinessType(
  type: BusinessType,
  stylePreset?: ThemePreset,
): TenantTheme {
  const dasar: TenantTheme = { ...PRESETS[type].theme };
  return stylePreset ? applyThemePreset(dasar, stylePreset) : dasar;
}

export function templateIdForBusinessType(type: BusinessType): string {
  return PRESETS[type].templateId;
}

function waLink(whatsapp: string, message: string): string {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
}

/** Kalimat "tentang kami" dari jawaban wizard — bukan placeholder. */
function aboutBody(answers: WizardAnswers, preset: Preset): string {
  const items = answers.highlights.map((h) => h.name);
  const andalan =
    items.length === 1
      ? items[0]
      : `${items.slice(0, -1).join(", ")} dan ${items[items.length - 1]}`;
  const jam = answers.openingHours?.[0];
  const kalimatJam = jam ? ` Kami buka ${jam.days} pukul ${jam.open}–${jam.close}.` : "";
  return (
    `${answers.businessName} adalah ${preset.noun} yang melayani pelanggan di ${answers.address}. ` +
    `Andalan kami: ${andalan}.${kalimatJam} ` +
    `Ada pertanyaan? Hubungi kami langsung lewat WhatsApp — dibalas cepat di jam kerja.`
  );
}

/**
 * Resolusi `mediaId` → URL yang bisa dirender.
 *
 * `wizardHighlightSchema` hanya menyimpan `mediaId` (kontrak), sedangkan
 * `BlockImage` butuh `url`. Resolusinya adalah tugas backend saat materialisasi,
 * jadi di mock ia di-inject pemanggil — bukan ditebak di sini, dan schema shared
 * tidak perlu diubah.
 */
export type MediaUrlResolver = (mediaId: string) => string;

/** 1–3 andalan wizard → item block (nama, harga & foto opsional). */
function highlightItems(answers: WizardAnswers, mediaUrl?: MediaUrlResolver): MenuItem[] {
  return answers.highlights.map((h) => ({
    name: h.name,
    ...(h.price !== undefined ? { price: h.price } : {}),
    ...(h.mediaId
      ? { image: { mediaId: h.mediaId, ...(mediaUrl ? { url: mediaUrl(h.mediaId) } : {}), alt: h.name } }
      : {}),
  }));
}

/**
 * Andalan → block yang paling sesuai per jenis usaha. Kuliner memakai
 * `featured_menu`; sisanya `services` (grid kartu nama + harga opsional).
 * Keduanya menerima harga opsional, jadi user tak wajib mengisi harga.
 */
function highlightBlock(answers: WizardAnswers, preset: Preset, mediaUrl?: MediaUrlResolver): Block {
  const items = highlightItems(answers, mediaUrl);
  if (answers.businessType === "kuliner") {
    return { type: "featured_menu", data: { heading: preset.highlightHeading, items } };
  }
  return { type: "services", data: { heading: preset.highlightHeading, items } };
}

function section(sectionKey: string, order: number, blocks: Block[]): Section {
  return { sectionKey, order, styleJson: {}, blocks };
}

/**
 * Bangun situs lengkap dari jawaban wizard.
 *
 * @param subdomain alamat situs yang sudah dipilih user (step subdomain).
 * @param status status tenant saat ini (`draft` sebelum dibayar).
 */
export function materializeWizard(
  subdomain: string,
  answers: WizardAnswers,
  status: TenantStatus = "draft",
  publishedAt: string | null = null,
  mediaUrl?: MediaUrlResolver,
): TenantFixture {
  const preset = PRESETS[answers.businessType];
  const isKuliner = answers.businessType === "kuliner";
  const wa = answers.whatsapp;
  const tagline = answers.tagline?.trim();

  const nav = [
    { slug: "home", title: "Beranda" },
    ...(isKuliner ? [{ slug: "menu", title: "Menu" }] : []),
  ];

  const navbar: Block = {
    type: "navbar",
    data: {
      links: nav.map((n) => ({ label: n.title, href: n.slug === "home" ? "/" : `/${n.slug}` })),
      sticky: true,
    },
  };

  const footerBlocks: Block[] = [
    {
      type: "footer",
      data: {
        // Badge + backlink plan dasar (viral loop akuisisi, PLAN-FRONTEND §3.2).
        text: `© ${new Date().getFullYear()} ${answers.businessName}. Dibuat dengan MarketIndonesia.`,
        links: [{ label: "Dibuat dengan MarketIndonesia", href: "https://marketindonesia.co.id" }],
      },
    },
    {
      type: "whatsapp_float",
      data: { whatsapp: wa, defaultMessage: preset.waMessage(answers.businessName), position: "right" },
    },
  ];

  const home: Section[] = [];
  let order = 0;
  home.push(section("navbar", order++, [navbar]));
  home.push(
    section("hero", order++, [
      {
        type: "hero",
        data: {
          heading: answers.businessName,
          subheading: tagline || `${preset.noun.replace(/^./, (c) => c.toUpperCase())} di ${answers.address}.`,
          align: "center",
          ctas: [
            {
              label: preset.ctaLabel,
              href: waLink(wa, preset.waMessage(answers.businessName)),
              variant: "primary",
            },
            ...(isKuliner
              ? [{ label: "Lihat Menu", href: "/menu", variant: "outline" as const }]
              : []),
          ],
        },
      },
    ]),
  );
  home.push(section("highlights", order++, [highlightBlock(answers, preset, mediaUrl)]));

  /*
   * Otomotif: daftar unit yang benar-benar dijual, langsung di beranda.
   *
   * Slot "highlights" hanya memuat 1–3 andalan berupa teks dari wizard; itu
   * bukan etalase. Tanpa section ini, seluruh model hasil seed katalog hanya
   * bisa ditemukan lewat /mobil — padahal beranda adalah halaman yang dibagikan
   * sales ke calon pembeli. Tiap kartu menautkan ke halaman model.
   */
  if (answers.businessType === "otomotif") {
    home.push(
      section("model_grid", order++, [
        {
          type: "model_grid",
          data: {
            heading: "Mobil yang Kami Jual",
            limit: 6,
            sort: "order",
            tampilkanFilter: false,
          },
        },
      ]),
    );
  }
  home.push(
    section("about", order++, [
      { type: "about", data: { heading: "Tentang Kami", body: aboutBody(answers, preset) } },
    ]),
  );

  if (answers.openingHours?.length) {
    home.push(
      section("opening_hours", order++, [
        { type: "opening_hours", data: { heading: "Jam Buka", hours: answers.openingHours } },
      ]),
    );
  }

  home.push(
    section("cta_band", order++, [
      {
        type: "cta_band",
        data: {
          heading: `Siap melayani Anda`,
          subheading: `Chat ${answers.businessName} sekarang, dibalas cepat lewat WhatsApp.`,
          cta: {
            label: preset.ctaLabel,
            href: waLink(wa, preset.waMessage(answers.businessName)),
            variant: "primary",
          },
        },
      },
    ]),
  );

  home.push(
    section("contact", order++, [
      {
        type: "contact",
        data: {
          heading: "Hubungi Kami",
          address: answers.address,
          whatsapp: wa,
          mapEmbedUrl: `https://www.google.com/maps?q=${encodeURIComponent(answers.address)}&output=embed`,
          showForm: true,
        },
      },
    ]),
  );
  home.push(section("footer", order++, footerBlocks));

  const pages: Record<string, RenderPageResponse> = {
    home: {
      page: {
        slug: "home",
        title: "Beranda",
        seoJson: {
          title: tagline ? `${answers.businessName} — ${tagline}` : answers.businessName,
          description: aboutBody(answers, preset).slice(0, 160),
        },
      },
      sections: home,
    },
  };

  // Kuliner mendapat halaman menu terpisah (andalan wizard sebagai grup awal).
  if (isKuliner) {
    pages.menu = {
      page: {
        slug: "menu",
        title: "Menu",
        seoJson: {
          title: `Menu — ${answers.businessName}`,
          description: `Daftar menu ${answers.businessName} di ${answers.address}.`,
        },
      },
      sections: [
        section("navbar", 0, [navbar]),
        section("menu", 1, [
          {
            type: "menu",
            data: {
              heading: "Menu Kami",
              groups: [{ title: preset.highlightHeading, items: highlightItems(answers, mediaUrl) }],
            },
          },
        ]),
        section("footer", 2, footerBlocks),
      ],
    };
  }

  return {
    site: {
      tenant: { subdomain, status, publishedAt },
      theme: themeForBusinessType(answers.businessType, answers.stylePreset),
      template: { slug: preset.templateSlug },
      // Nama usaha jadi wordmark di navigasi & kaki situs (shared 1.2.0).
      // Tanpa ini renderer tidak punya satu pun sumber identitas tenant.
      brandName: answers.businessName,
      nav,
      contact: { whatsapp: wa, address: answers.address },
    },
    pages,
  };
}
