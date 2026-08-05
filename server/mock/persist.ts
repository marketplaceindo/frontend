/**
 * Registry snapshot state mock (khusus dev).
 *
 * Seluruh store mock hidup di memori proses. Itu tidak masalah untuk test, tapi
 * fatal saat dipakai mencoba produk: Nitro me-restart tiap kali file server
 * berubah, dan situs yang baru saja dibuat user lenyap tanpa jejak. Yang hilang
 * bukan cache, melainkan pekerjaannya.
 *
 * Modul ini SENGAJA tidak menyentuh filesystem: proyek ini tidak memasang
 * `@types/node`, dan store di sini juga diuji unit di luar Nitro. I/O-nya hidup
 * di `server/plugins/mock-persist.ts` lewat `useStorage()`.
 */

/** Satu store yang ikut disimpan; `dump` harus mengembalikan data JSON-able. */
export interface PersistableStore<T = unknown> {
  dump(): T;
  restore(data: T): void;
}

const stores = new Map<string, PersistableStore<never>>();

/**
 * Daftarkan store. Dipanggil di level modul, jadi urutannya mengikuti urutan
 * impor — pemulihan dijalankan plugin setelah semua modul termuat.
 */
export function registerStore<T>(name: string, store: PersistableStore<T>): void {
  stores.set(name, store as PersistableStore<never>);
}

/** Kumpulkan snapshot seluruh store. */
export function dumpAll(): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [name, store] of stores) {
    try {
      data[name] = store.dump();
    } catch {
      // Satu store bermasalah tidak boleh membatalkan snapshot store lain.
    }
  }
  return data;
}

/** Pulihkan store dari snapshot; mengembalikan nama store yang berhasil. */
export function restoreAll(data: Record<string, unknown> | undefined): string[] {
  if (!data) return [];
  const dipulihkan: string[] = [];
  for (const [name, store] of stores) {
    const bagian = data[name];
    if (bagian === undefined) continue;
    try {
      store.restore(bagian as never);
      dipulihkan.push(name);
    } catch {
      // Bentuk data berubah (mis. setelah refactor) → store itu mulai bersih,
      // bukan menggagalkan seluruh boot.
    }
  }
  return dipulihkan;
}

// ---------------------------------------------------------------------------
// base64 portabel — `Buffer` tidak tersedia di tipe proyek ini.
// ---------------------------------------------------------------------------

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : B64[b2 & 63];
  }
  return out;
}

export function base64ToBytes(text: string): Uint8Array {
  const bersih = text.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array((bersih.length * 3) >> 2);
  let p = 0;
  for (let i = 0; i < bersih.length; i += 4) {
    const n =
      (B64.indexOf(bersih[i]!) << 18) |
      (B64.indexOf(bersih[i + 1]!) << 12) |
      ((bersih[i + 2] ? B64.indexOf(bersih[i + 2]!) : 0) << 6) |
      (bersih[i + 3] ? B64.indexOf(bersih[i + 3]!) : 0);
    out[p++] = (n >> 16) & 255;
    if (bersih[i + 2]) out[p++] = (n >> 8) & 255;
    if (bersih[i + 3]) out[p++] = n & 255;
  }
  return out.subarray(0, p);
}
