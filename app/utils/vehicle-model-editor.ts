/**
 * Logika editor model & varian kendaraan baru (Fase 7c butir 4).
 *
 * Sengaja murni dan terpisah dari komponen: aturan provenance di bawah ini
 * menentukan apakah angka yang dilihat pembeli boleh disebut "OTR pasti" atau
 * hanya estimasi — itu terlalu penting untuk hidup di dalam handler tombol.
 */
import {
  specsByGroupFor,
  type OtrPrice,
  type SpecDef,
  type SpecValue,
  type VehicleVariant,
  type VehicleVertical,
} from "@marketplaceindo/shared";

/** Satu grup field spesifikasi untuk form varian. */
export interface SpecFieldGroup {
  group: string;
  fields: SpecDef[];
}

/**
 * Field spesifikasi yang boleh muncul untuk satu vertikal.
 *
 * `kaki.tipe_rangka` tidak pernah relevan pada mobil, dan
 * `keselamatan.jumlah_airbag` tidak pernah relevan pada motor — menampilkannya
 * membuat sales mengisi data yang tak akan pernah tampil di tabel compare.
 */
export function specFieldGroups(vertical: VehicleVertical): SpecFieldGroup[] {
  return specsByGroupFor(vertical)
    .map((g) => ({ group: g.group, fields: [...g.specs] }))
    .filter((g) => g.fields.length > 0);
}

/**
 * Key yang KOSONG di varian ini tapi terisi di varian lain pada model yang sama.
 * Ini yang mencegah tabel compare bolong: satu kolom kosong sendirian jauh lebih
 * merugikan daripada seluruh baris kosong.
 */
export function specKosongDiVarianLain(
  variants: readonly Pick<VehicleVariant, "specs">[],
  index: number,
): string[] {
  const ini = variants[index]?.specs ?? {};
  const lain = new Set<string>();
  variants.forEach((v, i) => {
    if (i === index) return;
    for (const [key, value] of Object.entries(v.specs ?? {})) {
      if (value !== undefined && value !== null && value !== "") lain.add(key);
    }
  });
  return [...lain]
    .filter((key) => {
      const nilai = (ini as Record<string, SpecValue | undefined>)[key];
      return nilai === undefined || nilai === null || nilai === "";
    })
    .sort();
}

function nowIso(now?: string): string {
  return now ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Slug turunan nama varian; dipakai saat membuat & menduplikat. */
export function slugVarian(nama: string): string {
  return (
    nama
      .toLowerCase()
      .trim()
      .replace(/[\s_.]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "varian"
  );
}

/** Varian kosong baru — harga per kota disiapkan dari daftar kota tenant. */
export function varianBaru(
  nama: string,
  trimRank: number,
  cities: readonly { code: string; name: string }[],
): VehicleVariant {
  return {
    id: globalThis.crypto.randomUUID(),
    slug: slugVarian(nama),
    name: nama,
    trimRank,
    priceOtr: cities.map((c) => ({ cityCode: c.code, cityName: c.name, price: 0 })),
    colors: [],
    specs: {},
    specsCustom: [],
    highlights: [],
    stockStatus: "ready",
    isFeatured: false,
    priceSource: "manual",
    priceEstimated: false,
  };
}

/**
 * Duplikat varian — alur nyata sales: isi varian tertinggi lengkap, lalu
 * duplikat dan ubah nama, harga, serta beberapa spec yang berbeda. Tanpa ini
 * mengisi 4 varian butuh ~20 menit dan user menyerah di tengah jalan.
 *
 * Hasil duplikat BUKAN lagi data katalog: `catalogVariantId` dilepas,
 * `priceSource` kembali ke `manual`, dan `priceEstimated` dimatikan. Menyalin
 * provenance akan membuat badge "Dari katalog" berbohong.
 */
export function duplikatVarian(
  sumber: VehicleVariant,
  opts: { nama?: string; trimRank?: number; now?: string } = {},
): VehicleVariant {
  const nama = opts.nama ?? `${sumber.name} (salinan)`;
  const {
    catalogVariantId: _lepas,
    priceEstimatedFromCity: _lepasKota,
    ...sisa
  } = sumber;

  return {
    ...structuredClone(sisa),
    id: globalThis.crypto.randomUUID(),
    slug: slugVarian(nama),
    name: nama,
    trimRank: opts.trimRank ?? sumber.trimRank + 1,
    // Salinan tidak boleh mewarisi status "unggulan" dari sumbernya.
    isFeatured: false,
    priceSource: "manual",
    priceEstimated: false,
    priceUpdatedAt: nowIso(opts.now),
  };
}

/**
 * Set harga satu kota secara manual.
 *
 * Menyentuh harga = tenant sudah mengonfirmasi angkanya sendiri, jadi status
 * estimasi (hasil fallback rantai kota D-14) WAJIB mati dan sumbernya menjadi
 * `manual`. Membiarkannya "estimasi" akan menampilkan disclaimer di situs
 * publik untuk angka yang sebenarnya sudah pasti.
 */
export function setHargaKota(
  variant: VehicleVariant,
  cityCode: string,
  price: number,
  opts: { cityName?: string; now?: string } = {},
): VehicleVariant {
  const priceOtr: OtrPrice[] = variant.priceOtr.some((p) => p.cityCode === cityCode)
    ? variant.priceOtr.map((p) => (p.cityCode === cityCode ? { ...p, price } : p))
    : [
        ...variant.priceOtr,
        { cityCode, cityName: opts.cityName ?? cityCode, price },
      ];

  const { priceEstimatedFromCity: _buang, ...sisa } = variant;
  return {
    ...sisa,
    priceOtr,
    priceSource: "manual",
    priceEstimated: false,
    priceUpdatedAt: nowIso(opts.now),
  };
}

/**
 * Terapkan selisih ke SELURUH kota sekaligus (mis. +Rp2.000.000).
 * Harga tidak pernah dibiarkan negatif — dibatasi di 0.
 */
export function terapkanSelisihSemuaKota(
  variant: VehicleVariant,
  delta: number,
  opts: { now?: string } = {},
): VehicleVariant {
  const { priceEstimatedFromCity: _buang, ...sisa } = variant;
  return {
    ...sisa,
    priceOtr: variant.priceOtr.map((p) => ({ ...p, price: Math.max(0, p.price + delta) })),
    priceSource: "manual",
    priceEstimated: false,
    priceUpdatedAt: nowIso(opts.now),
  };
}

/** Berapa model yang masih `isPublished: false` — bahan banner checklist. */
export function jumlahBelumTerbit(models: readonly { isPublished: boolean }[]): number {
  return models.filter((m) => !m.isPublished).length;
}
