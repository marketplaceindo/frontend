/**
 * Perkecil gambar di browser sebelum upload (PLAN-FRONTEND §7c.3). Mayoritas
 * user meng-upload langsung dari kamera HP (3–8 MB); menurunkannya ke sisi
 * terpanjang 1600 px memangkas kuota, waktu upload di jaringan seluler, dan
 * ukuran gambar yang nanti dimuat pengunjung situs.
 *
 * Gagal decode (format aneh/HEIC di browser lama) → file asli dikembalikan apa
 * adanya; validasi tipe & ukuran tetap di server (kontrak §6).
 */
const MAX_EDGE = 1600;
const QUALITY = 0.82;

export async function resizeImage(file: File, maxEdge = MAX_EDGE): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1_000_000) {
    bitmap.close();
    return file;
  }

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // PNG dipertahankan (transparansi logo); sisanya jadi JPEG yang jauh lebih kecil.
  const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mimeType, QUALITY),
  );
  if (!blob || blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + (mimeType === "image/png" ? ".png" : ".jpg");
  return new File([blob], name, { type: mimeType });
}
