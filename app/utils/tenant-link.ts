/**
 * Menjaga mode preview tetap menempel saat berpindah halaman di situs tenant.
 *
 * Situs `draft` HANYA bisa diakses lewat `?preview=1` — tanpa itu render API
 * membalas 404 (memang disengaja: situs yang belum terbit tidak boleh terlihat
 * ada dari luar). Konsekuensinya, satu tautan internal yang lupa membawa
 * `preview=1` akan melempar user dari pratinjau ke halaman "Situs tidak
 * ditemukan" — persis di tengah ia sedang memeriksa situsnya sendiri.
 *
 * Karena itu SEMUA tautan internal situs tenant harus melewati helper ini.
 */

/**
 * Tambahkan `preview=1` pada tautan internal. Tautan eksternal (`https://`,
 * `wa.me`, `mailto:`) dan anchor (`#kredit`) dibiarkan apa adanya — menempeli
 * query di situ tidak ada gunanya dan bisa merusak deep link WhatsApp.
 */
export function withPreview(href: string, preview: boolean): string {
  if (!preview || !href.startsWith("/")) return href;

  const [path = "", query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  if (params.get("preview") === "1") return href;
  params.set("preview", "1");
  return `${path}?${params.toString()}`;
}
