import { dumpAll, restoreAll } from "../mock/persist";

/**
 * Menjaga state mock tetap ada di seluruh restart dev server.
 *
 * Nitro me-restart tiap kali file server berubah. Tanpa ini, situs yang baru
 * saja dibuat user lenyap di tengah sesi mencoba produk. Aktif hanya saat
 * `dashboardMock` menyala; begitu backend NestJS dipakai, seluruh state hidup
 * di sana dan plugin ini tidak melakukan apa-apa.
 *
 * Memakai `useStorage()` (unstorage bawaan Nitro), bukan `node:fs`: proyek ini
 * tidak memasang `@types/node`, dan storage bawaan sudah dipetakan ke disk di
 * dev. Ini BUKAN database — tidak ada migrasi maupun penguncian.
 */
const KEY = "mock-state.json";

export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig();
  if (!config.dashboardMock) return;

  const storage = useStorage("cache");
  let siap = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function simpan() {
    if (!siap) return; // jangan menimpa sebelum sempat dibaca
    try {
      await storage.setItem(KEY, { versi: 1, data: dumpAll() });
    } catch {
      // Disk penuh/readonly: dev tetap jalan, hanya tidak persisten.
    }
  }

  /** Mutasi datang beruntun (satu wizard = puluhan tulis) → digabung. */
  function jadwalkan() {
    clearTimeout(timer);
    timer = setTimeout(() => void simpan(), 300);
  }

  // Pemulihan asinkron; request yang datang sebelum selesai hanya melihat state
  // kosong — konsisten dengan perilaku sebelum ada persistensi.
  void (async () => {
    try {
      const isi = (await storage.getItem(KEY)) as
        | { versi?: number; data?: Record<string, unknown> }
        | null;
      const dipulihkan = restoreAll(isi?.data);
      if (dipulihkan.length) {
        console.info(`[mock] state dipulihkan: ${dipulihkan.join(", ")}`);
      }
    } catch {
      // Berkas rusak → mulai dari kosong.
    } finally {
      siap = true;
    }
  })();

  nitroApp.hooks.hook("afterResponse", (event) => {
    if (event.method === "GET" || event.method === "HEAD") return;
    jadwalkan();
  });

  // Simpan sekali lagi saat proses berhenti supaya mutasi terakhir tidak hilang
  // di jendela debounce.
  nitroApp.hooks.hook("close", () => simpan());
});
