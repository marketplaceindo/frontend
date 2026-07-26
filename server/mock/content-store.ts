/**
 * Mock modul Content — Pages/Sections/Blocks (Fase 7c; kontrak §5). Seluruh
 * endpoint modul ini bekerja pada **draft**; situs publik membaca snapshot yang
 * dibekukan saat publish (lihat `render-store.publishDraftSite`).
 *
 * Konten awal disemai dari hasil materialisasi wizard, lalu menjadi milik editor
 * (bukan lagi turunan jawaban wizard) — mengedit hero tidak boleh tertimpa saat
 * tenant menyimpan hal lain.
 *
 * Bebas dependensi Nitro/h3 → bisa diuji unit murni.
 */
import { ZodError } from "zod";
import {
  blockSchema,
  createPageRequestSchema,
  pageSeoSchema,
  replaceBlocksRequestSchema,
  sectionStyleSchema,
  slugSchema,
  updatePageRequestSchema,
  updateSectionRequestSchema,
  type Block,
  type Page,
  type PageDetailResponse,
  type PageSeo,
  type RenderPageResponse,
  type Section,
  type SectionStyle,
  type TenantTheme,
  type TenantStatus,
} from "@marketplaceindo/shared";
import { TenantApiError } from "./api-error";
import { collectionsOf } from "./collection-store";
import { allowedBlockTypes } from "./templates";
import type { TenantFixture } from "./render-store";

interface StoredSection {
  id: string;
  sectionKey: string;
  order: number;
  enabled: boolean;
  styleJson: SectionStyle;
  blocks: Block[];
}

interface StoredPage {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  seoJson?: PageSeo;
  updatedAt: string;
  sections: StoredSection[];
}

interface TenantContent {
  pages: StoredPage[];
  templateSlug: string;
  contact: { whatsapp: string; address: string };
}

const contents = new Map<string, TenantContent>();
/** Indeks pageId → tenantId (kontrak §5 memakai /pages/:pageId tanpa tenant). */
const pageOwner = new Map<string, string>();

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function content(tenantId: string): TenantContent {
  const found = contents.get(tenantId);
  if (!found) throw new TenantApiError(404, "NOT_FOUND", "Konten situs belum dibuat");
  return found;
}

/** Tenant pemilik sebuah halaman — dipakai pemanggil untuk cek kepemilikan (§1.5). */
export function tenantIdOfPage(pageId: string): string {
  const tenantId = pageOwner.get(pageId);
  if (!tenantId) throw new TenantApiError(404, "NOT_FOUND", "Halaman tidak ditemukan");
  return tenantId;
}

function findPage(tenantId: string, pageId: string): StoredPage {
  const page = content(tenantId).pages.find((p) => p.id === pageId);
  if (!page) throw new TenantApiError(404, "NOT_FOUND", "Halaman tidak ditemukan");
  return page;
}

function publicPage(page: StoredPage): Page {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    ...(page.seoJson ? { seoJson: page.seoJson } : {}),
    updatedAt: page.updatedAt,
  };
}

function publicSection(section: StoredSection): Section {
  return {
    id: section.id,
    sectionKey: section.sectionKey,
    order: section.order,
    enabled: section.enabled,
    styleJson: section.styleJson,
  };
}

// ---------------------------------------------------------------------------
// Semai & sinkronisasi ke render store
// ---------------------------------------------------------------------------

/**
 * Semai konten draft dari hasil materialisasi wizard. Menimpa konten lama —
 * dipanggil hanya oleh jalur wizard (yang memang re-materialisasi, kontrak §3).
 */
export function seedContentFromFixture(tenantId: string, fixture: TenantFixture): void {
  for (const page of contents.get(tenantId)?.pages ?? []) pageOwner.delete(page.id);

  const pages: StoredPage[] = Object.values(fixture.pages).map((rendered) => {
    const id = crypto.randomUUID();
    pageOwner.set(id, tenantId);
    return {
      id,
      tenantId,
      slug: rendered.page.slug,
      title: rendered.page.title,
      ...(rendered.page.seoJson ? { seoJson: rendered.page.seoJson } : {}),
      updatedAt: nowIso(),
      sections: rendered.sections.map((s) => ({
        id: crypto.randomUUID(),
        sectionKey: s.sectionKey,
        order: s.order,
        enabled: true,
        styleJson: s.styleJson,
        blocks: s.blocks,
      })),
    };
  });

  contents.set(tenantId, {
    pages,
    templateSlug: fixture.site.template.slug,
    contact: fixture.site.contact,
  });
}

export function hasContent(tenantId: string): boolean {
  return (contents.get(tenantId)?.pages.length ?? 0) > 0;
}

export interface FixtureMeta {
  subdomain: string;
  status: TenantStatus;
  publishedAt: string | null;
  theme: TenantTheme;
}

/**
 * Susun konten draft jadi bentuk render API (`TenantFixture`). Section yang
 * dinonaktifkan tidak ikut ter-render — itulah arti toggle di editor.
 * Nav diturunkan dari daftar halaman supaya menu situs selalu ikut editor.
 */
export function contentToFixture(tenantId: string, meta: FixtureMeta): TenantFixture {
  const c = content(tenantId);
  const ordered = [...c.pages].sort((a, b) =>
    a.slug === "home" ? -1 : b.slug === "home" ? 1 : a.slug.localeCompare(b.slug),
  );

  const pages: Record<string, RenderPageResponse> = {};
  for (const page of ordered) {
    pages[page.slug] = {
      page: {
        slug: page.slug,
        title: page.title,
        ...(page.seoJson ? { seoJson: page.seoJson } : {}),
      },
      sections: [...page.sections]
        .filter((s) => s.enabled)
        .sort((a, b) => a.order - b.order)
        .map((s) => ({
          sectionKey: s.sectionKey,
          order: s.order,
          styleJson: s.styleJson,
          blocks: s.blocks,
        })),
    };
  }

  // Koleksi ikut dibekukan bersama konten → snapshot publish konsisten.
  const { vehicles, products } = collectionsOf(tenantId);

  return {
    site: {
      tenant: {
        subdomain: meta.subdomain,
        status: meta.status,
        publishedAt: meta.publishedAt,
      },
      theme: meta.theme,
      template: { slug: c.templateSlug },
      nav: ordered.map((p) => ({ slug: p.slug, title: p.title })),
      contact: c.contact,
    },
    pages,
    ...(vehicles.length ? { vehicles } : {}),
    ...(products.length ? { products } : {}),
  };
}

// ---------------------------------------------------------------------------
// Pages (kontrak §5)
// ---------------------------------------------------------------------------

/** GET /v1/tenants/:id/pages */
export function listPages(tenantId: string): { items: Page[] } {
  return { items: content(tenantId).pages.map(publicPage) };
}

/** POST /v1/tenants/:id/pages */
export function createPage(tenantId: string, raw: unknown): Page {
  const body = createPageRequestSchema.parse(raw);
  const c = content(tenantId);
  const slug = body.slug.toLowerCase();

  if (!slugSchema.safeParse(slug).success) {
    throw new ZodError([
      { code: "custom", path: ["slug"], message: "Gunakan huruf kecil, angka, dan tanda hubung" },
    ]);
  }
  if (c.pages.some((p) => p.slug === slug)) {
    throw new TenantApiError(409, "SLUG_TAKEN", "Alamat halaman ini sudah dipakai");
  }
  // `mobil`/`produk` dipesan route listing koleksi (lihat README Fase 5).
  if (slug === "mobil" || slug === "produk") {
    throw new TenantApiError(409, "SLUG_TAKEN", "Alamat ini dipakai halaman koleksi");
  }

  const id = crypto.randomUUID();
  pageOwner.set(id, tenantId);
  const page: StoredPage = {
    id,
    tenantId,
    slug,
    title: body.title,
    updatedAt: nowIso(),
    // Halaman baru selalu punya navbar + footer supaya situs tetap konsisten.
    sections: [
      {
        id: crypto.randomUUID(),
        sectionKey: "navbar",
        order: 0,
        enabled: true,
        styleJson: {},
        blocks: navbarBlockOf(c),
      },
      {
        id: crypto.randomUUID(),
        sectionKey: "footer",
        order: 1,
        enabled: true,
        styleJson: {},
        blocks: footerBlockOf(c),
      },
    ],
  };
  c.pages.push(page);
  return publicPage(page);
}

/** Salin navbar/footer dari halaman beranda supaya halaman baru tidak kosong. */
function navbarBlockOf(c: TenantContent): Block[] {
  const home = c.pages.find((p) => p.slug === "home");
  const navbar = home?.sections.find((s) => s.sectionKey === "navbar")?.blocks;
  return navbar ? structuredClone(navbar) : [{ type: "navbar", data: { links: [], sticky: true } }];
}

function footerBlockOf(c: TenantContent): Block[] {
  const home = c.pages.find((p) => p.slug === "home");
  const footer = home?.sections.find((s) => s.sectionKey === "footer")?.blocks;
  return footer ? structuredClone(footer) : [{ type: "footer", data: {} }];
}

/** PATCH /v1/pages/:pageId */
export function updatePage(tenantId: string, pageId: string, raw: unknown): Page {
  const body = updatePageRequestSchema.parse(raw);
  const page = findPage(tenantId, pageId);
  if (body.title !== undefined) page.title = body.title;
  if (body.seoJson !== undefined) page.seoJson = pageSeoSchema.parse(body.seoJson);
  page.updatedAt = nowIso();
  return publicPage(page);
}

/** DELETE /v1/pages/:pageId */
export function deletePage(tenantId: string, pageId: string): void {
  const c = content(tenantId);
  const page = findPage(tenantId, pageId);
  if (page.slug === "home") {
    throw new TenantApiError(409, "CONFIRMATION_REQUIRED", "Beranda tidak bisa dihapus");
  }
  c.pages = c.pages.filter((p) => p.id !== pageId);
  pageOwner.delete(pageId);
}

/** GET /v1/pages/:pageId — payload penuh untuk editor. */
export function getPageDetail(tenantId: string, pageId: string): PageDetailResponse {
  const page = findPage(tenantId, pageId);
  return {
    page: publicPage(page),
    sections: [...page.sections]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ ...publicSection(s), blocks: s.blocks })),
  };
}

// ---------------------------------------------------------------------------
// Sections & blocks (kontrak §5)
// ---------------------------------------------------------------------------

/** PATCH /v1/pages/:pageId/sections/:sectionId — style, urutan, aktif/nonaktif. */
export function updateSection(
  tenantId: string,
  pageId: string,
  sectionId: string,
  raw: unknown,
): Section {
  const body = updateSectionRequestSchema.parse(raw);
  const page = findPage(tenantId, pageId);
  const section = page.sections.find((s) => s.id === sectionId);
  if (!section) throw new TenantApiError(404, "NOT_FOUND", "Section tidak ditemukan");

  if (body.styleJson !== undefined) section.styleJson = sectionStyleSchema.parse(body.styleJson);
  if (body.enabled !== undefined) section.enabled = body.enabled;
  if (body.order !== undefined) reorderSection(page, section, body.order);

  page.updatedAt = nowIso();
  return publicSection(section);
}

/**
 * Pindahkan section ke posisi `target`, lalu rapatkan `order` semua section
 * jadi 0..n-1 — mencegah nomor urut bolong/duplikat setelah banyak perpindahan.
 */
function reorderSection(page: StoredPage, section: StoredSection, target: number): void {
  const sorted = [...page.sections].sort((a, b) => a.order - b.order);
  const from = sorted.indexOf(section);
  const to = Math.max(0, Math.min(sorted.length - 1, target));
  sorted.splice(to, 0, ...sorted.splice(from, 1));
  sorted.forEach((s, i) => (s.order = i));
}

/** PUT /v1/pages/:pageId/sections/:sectionId/blocks — bulk replace. */
export function replaceBlocks(
  tenantId: string,
  pageId: string,
  sectionId: string,
  raw: unknown,
  templateId: string | null,
): { blocks: Block[] } {
  const body = replaceBlocksRequestSchema.parse(raw);
  const page = findPage(tenantId, pageId);
  const section = page.sections.find((s) => s.id === sectionId);
  if (!section) throw new TenantApiError(404, "NOT_FOUND", "Section tidak ditemukan");

  // Validasi ulang per-item agar fieldErrors ber-index (`blocks.0.data.heading`).
  const blocks = body.blocks.map((block, i) => {
    const parsed = blockSchema.safeParse(block);
    if (!parsed.success) {
      throw new ZodError(
        parsed.error.issues.map((issue) => ({ ...issue, path: ["blocks", i, ...issue.path] })),
      );
    }
    return parsed.data;
  });

  const allowed = allowedBlockTypes(templateId, page.slug, section.sectionKey);
  if (allowed) {
    const rejected = blocks.find((b) => !allowed.includes(b.type));
    if (rejected) {
      throw new TenantApiError(
        422,
        "BLOCK_NOT_ALLOWED_IN_SLOT",
        `Block "${rejected.type}" tidak bisa dipakai di bagian "${section.sectionKey}"`,
        { allowedBlockTypes: allowed },
      );
    }
  }

  section.blocks = blocks;
  page.updatedAt = nowIso();
  return { blocks };
}
