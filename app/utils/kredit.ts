/**
 * Kalkulator simulasi kredit (Fase 4) — dua metode sesuai plan:
 * - flat    : bunga dihitung dari pokok awal, sama tiap bulan.
 * - efektif : anuitas — angsuran tetap, porsi bunga menurun (rumus PMT).
 * Murni & teruji unit; komponen BlockSimulasiKredit hanya wiring input.
 */

export interface KreditParams {
  /** Harga unit (Rp). */
  harga: number;
  /** Uang muka, persen dari harga (0–100). */
  dpPersen: number;
  /** Tenor dalam bulan. */
  tenorBulan: number;
  /** Bunga per tahun, persen (mis. 6.5). */
  bungaTahunanPersen: number;
  metode: "flat" | "efektif";
}

export interface KreditHasil {
  uangMuka: number;
  pokokHutang: number;
  angsuranPerBulan: number;
  totalBunga: number;
  totalPembayaran: number;
}

export function hitungKredit(params: KreditParams): KreditHasil {
  const { harga, dpPersen, tenorBulan, bungaTahunanPersen, metode } = params;
  if (harga <= 0 || tenorBulan <= 0 || dpPersen < 0 || dpPersen >= 100 || bungaTahunanPersen < 0) {
    throw new RangeError("Parameter kredit di luar rentang wajar");
  }

  const uangMuka = Math.round((harga * dpPersen) / 100);
  const pokok = harga - uangMuka;

  let angsuran: number;
  if (metode === "flat") {
    const bungaPerBulan = (pokok * bungaTahunanPersen) / 100 / 12;
    angsuran = pokok / tenorBulan + bungaPerBulan;
  } else {
    const i = bungaTahunanPersen / 100 / 12;
    angsuran = i === 0 ? pokok / tenorBulan : (pokok * i) / (1 - (1 + i) ** -tenorBulan);
  }

  const angsuranBulat = Math.round(angsuran);
  const totalPembayaran = angsuranBulat * tenorBulan;
  return {
    uangMuka,
    pokokHutang: pokok,
    angsuranPerBulan: angsuranBulat,
    totalBunga: totalPembayaran - pokok,
    totalPembayaran,
  };
}
