/**
 * Round-trip harga lewat Excel — mock (kontrak §7.6, keputusan D-16).
 *
 * Formatnya sengaja **CSV berkode UTF-8**, bukan .xlsx: mock ini ada untuk
 * menguji ALUR (unduh → ubah → unggah → hasil per baris), bukan untuk meniru
 * penulis xlsx backend. Yang penting identik dengan produksi adalah aturannya:
 * pencocokan by `variantId`, nama berbeda hanya warning, harga sama tidak
 * menyentuh apa pun. Parsing angkanya memakai `parseHargaExcel()` dari shared —
 * fungsi yang sama persis dengan yang dipakai backend.
 */
import {
  INVENTORY_PRICE_COLUMNS,
  INVENTORY_PRICE_NOTE,
  parseHargaExcel,
  type InventoryPriceImportResult,
  type InventoryPriceWarning,
} from "@marketplaceindo/shared";
import { TenantApiError } from "./api-error";
import { listSeededModels } from "./catalog-store";

const SEP = ";";

function sel(value: string): string {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Baris: header, catatan, lalu satu baris per (varian, kota). */
export function exportPrices(tenantId: string): string {
  const baris: string[] = [
    INVENTORY_PRICE_COLUMNS.map((c) => sel(c.header)).join(SEP),
    [sel(""), sel(INVENTORY_PRICE_NOTE), "", "", "", ""].join(SEP),
  ];

  for (const model of listSeededModels(tenantId)) {
    for (const variant of model.variants) {
      for (const harga of variant.priceOtr) {
        baris.push(
          [
            sel(variant.id),
            sel(model.name),
            sel(variant.name),
            sel(harga.cityCode),
            sel(harga.cityName),
            String(harga.price),
          ].join(SEP),
        );
      }
    }
  }

  return `${baris.join("\n")}\n`;
}

function pecahBaris(raw: string): string[] {
  const out: string[] = [];
  let cur = "";
  let dalamKutip = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]!;
    if (ch === '"') {
      if (dalamKutip && raw[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else dalamKutip = !dalamKutip;
      continue;
    }
    if (ch === SEP && !dalamKutip) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function importPrices(tenantId: string, isi: string): InventoryPriceImportResult {
  if (isi.trim() === "") throw new TenantApiError(422, "VALIDATION_ERROR", "File kosong");

  const models = listSeededModels(tenantId);
  const perVarian = new Map(
    models.flatMap((m) => m.variants.map((v) => [v.id, { model: m, variant: v }] as const)),
  );

  const warnings: InventoryPriceWarning[] = [];
  let updated = 0;
  let skipped = 0;

  const baris = isi.replace(/\r\n/g, "\n").split("\n");

  // Baris 1 header, baris 2 catatan — data mulai baris 3 (1-based, seperti sheet).
  for (let i = 2; i < baris.length; i += 1) {
    const teks = baris[i]!;
    if (teks.trim() === "") continue;
    const nomor = i + 1;
    const kolom = pecahBaris(teks);

    const variantId = (kolom[0] ?? "").trim();
    if (variantId === "") continue;
    const variantName = (kolom[2] ?? "").trim();
    const cityCode = (kolom[3] ?? "").trim();
    const price = parseHargaExcel(kolom[5] ?? "");

    if (price === null || price <= 0) {
      warnings.push({
        row: nomor,
        kind: "price_invalid",
        message: `Harga baris ${nomor} tidak terbaca sebagai angka`,
      });
      continue;
    }

    // Varian milik tenant lain tidak ada di peta ini — dilaporkan seperti varian
    // yang tidak ditemukan, tanpa membocorkan bahwa ia ada di tempat lain.
    const target = perVarian.get(variantId);
    if (!target) {
      skipped += 1;
      warnings.push({
        row: nomor,
        kind: "variant_not_found",
        message: `Varian pada baris ${nomor} tidak ada di inventarismu`,
      });
      continue;
    }

    if (variantName !== "" && variantName !== target.variant.name) {
      warnings.push({
        row: nomor,
        kind: "name_mismatch",
        message: `Nama di file ("${variantName}") berbeda dengan data ("${target.variant.name}"). Harga tetap diterapkan.`,
      });
    }

    const otr = target.variant.priceOtr.find((p) => p.cityCode === cityCode);
    if (!otr) {
      skipped += 1;
      warnings.push({
        row: nomor,
        kind: "variant_not_found",
        message: `Varian pada baris ${nomor} tidak punya harga untuk kota ${cityCode}`,
      });
      continue;
    }

    if (otr.price === price) {
      skipped += 1;
      warnings.push({
        row: nomor,
        kind: "no_change",
        message: `Harga baris ${nomor} sama dengan sebelumnya`,
      });
      continue;
    }

    otr.price = price;
    target.variant.priceSource = "excel";
    target.variant.priceUpdatedAt = new Date().toISOString();
    // Tenant sudah mengonfirmasi angkanya sendiri — penanda estimasi gugur.
    target.variant.priceEstimated = false;
    delete target.variant.priceEstimatedFromCity;
    updated += 1;
  }

  return { updated, skipped, warnings };
}
