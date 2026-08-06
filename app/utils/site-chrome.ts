/**
 * Pemisahan "chrome" situs (navigasi, kaki, tombol mengambang) dari isi halaman.
 *
 * Kenapa ada:
 *
 * 1. **Navigasi sempat ganda.** `layouts/tenant.vue` dulu me-render `<header>`
 *    sendiri dari `site.nav`, sementara halaman juga punya section `navbar`
 *    berisi block `navbar` — dua baris navigasi bertumpuk di tiap halaman, dua-
 *    duanya tanpa gaya. Hal yang sama terjadi pada kaki situs.
 * 2. **Halaman katalog kehilangan chrome.** `/mobil`, `/mobil-bekas`,
 *    `/produk`, `/bandingkan` tidak melewati SectionRenderer, jadi mereka tidak
 *    pernah mendapat block `footer` maupun `whatsapp_float` sama sekali — dan
 *    kalau `<header>` layout dihapus begitu saja, navigasinya ikut hilang.
 *
 * Solusinya: block yang secara sifat adalah chrome situs — bukan isi halaman —
 * diangkat keluar dari aliran section, lalu di-render sekali oleh layout di
 * posisi yang benar (nav di atas, kaki di bawah, float melayang). Halaman yang
 * tidak punya section (katalog) memakai `chromeFromSite()` sebagai cadangan.
 *
 * Pemisahannya berdasarkan TIPE block, bukan `sectionKey`, supaya tenant yang
 * menamai sectionnya lain tetap mendapat susunan yang benar.
 */
import type { Block, RenderPageResponse, RenderTenantResponse } from "@marketplaceindo/shared";

type Section = RenderPageResponse["sections"][number];
type NavbarBlock = Extract<Block, { type: "navbar" }>;
type FooterBlock = Extract<Block, { type: "footer" }>;
type FloatBlock = Extract<Block, { type: "whatsapp_float" }>;

export interface SiteChrome {
  navbar: NavbarBlock | null;
  footer: FooterBlock | null;
  /** Tombol mengambang (WhatsApp) — selalu di luar aliran dokumen. */
  floats: FloatBlock[];
}

/**
 * Pisahkan chrome dari section isi. Section yang seluruh blocknya terangkat
 * ikut dibuang supaya tidak menyisakan wrapper kosong yang tetap memakan
 * padding vertikal.
 */
export function splitChrome(sections: Section[]): { chrome: SiteChrome; content: Section[] } {
  const chrome: SiteChrome = { navbar: null, footer: null, floats: [] };
  const content: Section[] = [];

  for (const section of sections) {
    const rest: Block[] = [];
    for (const block of section.blocks) {
      // Switch, bukan Set.has(): hanya perbandingan literal yang mempersempit
      // tipe union block sehingga `chrome.navbar = block` ter-typecheck.
      switch (block.type) {
        // Yang pertama menang: halaman tidak seharusnya punya dua navbar, tapi
        // kalau ada, satu yang ter-render lebih baik daripada dua bertumpuk.
        case "navbar":
          chrome.navbar ??= block;
          break;
        case "footer":
          chrome.footer ??= block;
          break;
        case "whatsapp_float":
          chrome.floats.push(block);
          break;
        default:
          rest.push(block);
      }
    }
    if (rest.length) content.push({ ...section, blocks: rest });
  }

  return { chrome, content };
}

/**
 * Chrome cadangan untuk halaman tanpa section (listing & detail katalog).
 * Tautannya dari `site.nav` — daftar halaman terbit — jadi navigasi tetap ada
 * meski halaman itu tidak menyimpan block navbar sendiri.
 */
export function chromeFromSite(site: RenderTenantResponse): SiteChrome {
  return {
    navbar: {
      type: "navbar",
      data: {
        links: site.nav.map((n) => ({
          label: n.title,
          href: n.slug === "home" ? "/" : `/${n.slug}`,
        })),
        sticky: true,
      },
    },
    footer: {
      type: "footer",
      data: {
        text: site.contact.address || undefined,
      },
    },
    floats: [
      {
        type: "whatsapp_float",
        data: { whatsapp: site.contact.whatsapp, position: "right" },
      },
    ],
  };
}

/** Gabungkan chrome halaman dengan cadangan — bagian yang kosong diisi cadangan. */
export function withChromeFallback(
  chrome: SiteChrome | undefined,
  site: RenderTenantResponse,
): SiteChrome {
  const fallback = chromeFromSite(site);
  if (!chrome) return fallback;
  return {
    navbar: chrome.navbar ?? fallback.navbar,
    footer: chrome.footer ?? fallback.footer,
    floats: chrome.floats.length ? chrome.floats : fallback.floats,
  };
}
