/**
 * Salin katalog kendaraan dari repo backend ke fixture mock frontend.
 *
 *   node scripts/sync-catalog.mjs [path-ke-repo-backend]
 *
 * Kenapa disalin, bukan dibaca langsung saat runtime: frontend dan backend
 * adalah repo terpisah yang di-deploy sendiri-sendiri. Membaca `../backend/...`
 * saat runtime akan bekerja di laptop dan gagal di server. Jadi hasilnya
 * di-commit sebagai fixture, dan skrip ini dijalankan ulang tiap katalog
 * backend berubah.
 *
 * Fixture ini TETAP data pengembangan. Harga di YAML backend sebagian masih
 * bertanda `BELUM-DIVERIFIKASI`; flag itu ikut disalin apa adanya supaya
 * statusnya tidak hilang di perjalanan.
 *
 * Catatan: memakai paket `yaml` yang datang transitif bersama Nuxt. Kalau suatu
 * saat hilang, pasang eksplisit sebagai devDependency — hanya skrip ini yang
 * terdampak, bukan aplikasinya.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";

const backendRoot = resolve(process.argv[2] ?? "../marketindonesia-backend");
const catalogRoot = join(backendRoot, "catalog");
const OUT = resolve("server/mock/fixtures/catalog.json");

/** UUID v4-shaped tapi deterministik dari kunci — id stabil antar-generate. */
function idFor(key) {
  const h = createHash("sha256").update(key).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `4${h.slice(13, 16)}`,
    ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32),
  ].join("-");
}

function bacaVertical(vertical) {
  const dir = join(catalogRoot, vertical);
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  } catch {
    return { brands: [], models: [] };
  }

  const brands = [];
  const models = [];

  for (const file of files.sort()) {
    const doc = parse(readFileSync(join(dir, file), "utf8"));
    if (!doc?.brand?.slug) {
      console.warn(`  ! ${vertical}/${file}: tidak ada blok brand, dilewati`);
      continue;
    }
    const brandId = idFor(`brand:${vertical}:${doc.brand.slug}`);
    brands.push({
      id: brandId,
      vertical,
      slug: doc.brand.slug,
      name: doc.brand.name,
      order: doc.brand.order ?? 99,
    });

    for (const m of doc.models ?? []) {
      const modelId = idFor(`model:${vertical}:${doc.brand.slug}:${m.slug}`);
      const prices = [];
      const variants = (m.variants ?? []).map((v) => {
        const variantId = idFor(`variant:${vertical}:${doc.brand.slug}:${m.slug}:${v.slug}`);
        for (const p of v.prices ?? []) {
          prices.push({
            variantId,
            cityCode: p.cityCode,
            price: p.price,
            effectiveFrom: String(p.effectiveFrom),
            source: p.source,
          });
        }
        return {
          id: variantId,
          modelId,
          slug: v.slug,
          name: v.name,
          trimRank: v.trimRank,
          specs: v.specs ?? {},
          colors: v.colors ?? [],
          highlights: v.highlights ?? [],
        };
      });

      models.push({
        id: modelId,
        brandId,
        vertical,
        slug: m.slug,
        name: m.name,
        modelYear: m.modelYear,
        bodyType: m.bodyType,
        images: m.images ?? [],
        summary: m.summary ?? "",
        popularityRank: m.popularityRank ?? 99,
        variants,
        prices,
      });
    }
  }
  return { brands, models };
}

const mobil = bacaVertical("mobil");
const motor = bacaVertical("motor");

const out = {
  _catatan:
    "Dibuat oleh scripts/sync-catalog.mjs dari repo backend. Jangan diedit tangan — jalankan ulang skripnya.",
  brands: [...mobil.brands, ...motor.brands],
  models: [...mobil.models, ...motor.models],
};

writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);

const perMerk = out.brands
  .map((b) => `${b.name}(${out.models.filter((m) => m.brandId === b.id).length})`)
  .join(", ");
console.log(`Katalog tersalin dari ${catalogRoot}`);
console.log(`  ${out.brands.length} merk, ${out.models.length} model → ${OUT}`);
console.log(`  ${perMerk}`);

const belumVerif = out.models.filter((m) =>
  m.prices.some((p) => String(p.source).includes("BELUM-DIVERIFIKASI")),
).length;
if (belumVerif) {
  console.log(`  catatan: ${belumVerif} model masih berharga PERKIRAAN (belum diverifikasi).`);
}
