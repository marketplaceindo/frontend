/**
 * Chrome situs (nav/kaki/float) — diangkat keluar dari aliran section.
 *
 * Regresi yang dijaga di sini adalah dua hal yang sama-sama lolos seluruh test
 * lama karena keduanya benar di DOM dan salah di layar:
 *
 * 1. Navigasi ganda. `layouts/tenant.vue` me-render <header> dari `site.nav`
 *    SEKALIGUS halaman me-render block `navbar` — dua baris tautan bertumpuk.
 * 2. Halaman katalog tanpa chrome. `/mobil`, `/mobil-bekas`, `/produk`,
 *    `/bandingkan` tidak melewati SectionRenderer, jadi tidak pernah mendapat
 *    kaki situs maupun tombol WhatsApp mengambang.
 */
import { describe, expect, it } from "vitest";
import type { Block, RenderPageResponse, RenderTenantResponse } from "@marketplaceindo/shared";
import { chromeFromSite, splitChrome, withChromeFallback } from "../app/utils/site-chrome";

type Section = RenderPageResponse["sections"][number];

const section = (sectionKey: string, order: number, blocks: Block[]): Section => ({
  sectionKey,
  order,
  styleJson: {},
  blocks,
});

const navbar: Block = {
  type: "navbar",
  data: { links: [{ label: "Beranda", href: "/" }], sticky: true },
};
const footer: Block = { type: "footer", data: { text: "© Otojaya" } };
const float: Block = { type: "whatsapp_float", data: { whatsapp: "6281234567890" } };
const hero: Block = { type: "hero", data: { heading: "Otojaya" } };

const site: RenderTenantResponse = {
  tenant: { subdomain: "otojaya", status: "active", publishedAt: null },
  theme: {},
  template: { slug: "otomotif" },
  brandName: "Otojaya Motor",
  nav: [
    { slug: "home", title: "Beranda" },
    { slug: "tentang", title: "Tentang" },
  ],
  contact: { whatsapp: "6281234567890", address: "Jl. Merdeka 1, Bandung" },
};

describe("splitChrome", () => {
  it("mengangkat navbar/footer/float keluar dari isi halaman", () => {
    const { chrome, content } = splitChrome([
      section("navbar", 0, [navbar]),
      section("hero", 1, [hero]),
      section("footer", 2, [footer, float]),
    ]);

    expect(chrome.navbar).toEqual(navbar);
    expect(chrome.footer).toEqual(footer);
    expect(chrome.floats).toEqual([float]);

    // Isi yang tersisa hanya hero — kalau navbar ikut ter-render di sini,
    // ia akan tampil dua kali bersama yang di layout.
    expect(content).toHaveLength(1);
    expect(content[0]!.blocks).toEqual([hero]);
  });

  it("section yang seluruh blocknya terangkat ikut dibuang", () => {
    const { content } = splitChrome([
      section("navbar", 0, [navbar]),
      section("footer", 1, [footer]),
    ]);
    // Menyisakan wrapper kosong berarti dua .section-shell yang tetap memakan
    // padding vertikal — celah kosong tak terjelaskan di atas & bawah halaman.
    expect(content).toEqual([]);
  });

  it("block chrome yang bercampur di section isi tetap terangkat", () => {
    const { chrome, content } = splitChrome([section("konten", 0, [hero, footer])]);
    expect(chrome.footer).toEqual(footer);
    expect(content[0]!.blocks).toEqual([hero]);
  });

  it("navbar kedua diabaikan — satu ter-render lebih baik dari dua bertumpuk", () => {
    const kedua: Block = { type: "navbar", data: { links: [], sticky: false } };
    const { chrome } = splitChrome([section("a", 0, [navbar]), section("b", 1, [kedua])]);
    expect(chrome.navbar).toEqual(navbar);
  });

  it("halaman tanpa chrome menghasilkan chrome kosong, bukan error", () => {
    const { chrome, content } = splitChrome([section("hero", 0, [hero])]);
    expect(chrome).toEqual({ navbar: null, footer: null, floats: [] });
    expect(content).toHaveLength(1);
  });
});

describe("chromeFromSite (cadangan halaman katalog)", () => {
  it("membangun navigasi dari daftar halaman terbit", () => {
    const chrome = chromeFromSite(site);
    expect(chrome.navbar?.data.links).toEqual([
      { label: "Beranda", href: "/" },
      { label: "Tentang", href: "/tentang" },
    ]);
  });

  it("kaki & tombol WhatsApp ikut ada — halaman katalog dulu tidak punya keduanya", () => {
    const chrome = chromeFromSite(site);
    expect(chrome.footer?.data.text).toBe("Jl. Merdeka 1, Bandung");
    expect(chrome.floats).toHaveLength(1);
    expect(chrome.floats[0]!.data.whatsapp).toBe("6281234567890");
  });
});

describe("withChromeFallback", () => {
  it("tanpa chrome halaman → seluruhnya dari site", () => {
    expect(withChromeFallback(undefined, site)).toEqual(chromeFromSite(site));
  });

  it("chrome halaman menang per bagian, sisanya diisi cadangan", () => {
    const hasil = withChromeFallback({ navbar, footer: null, floats: [] }, site);
    expect(hasil.navbar).toEqual(navbar);
    // Halaman punya navbar tapi tidak punya kaki → kaki tetap muncul.
    expect(hasil.footer?.data.text).toBe("Jl. Merdeka 1, Bandung");
    expect(hasil.floats).toHaveLength(1);
  });
});
