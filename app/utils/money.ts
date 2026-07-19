/** Format integer Rupiah kontrak §1.3 → tampilan "Rp1.234.567". */
export function formatRupiah(amount: number): string {
  return `Rp${amount.toLocaleString("id-ID")}`;
}
