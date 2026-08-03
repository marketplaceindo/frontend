<script setup lang="ts">
/**
 * Perbarui harga massal lewat Excel (§4.3, keputusan D-16).
 *
 * Dua langkah eksplisit: unduh → unggah. Pencocokan baris dilakukan backend
 * **by ID**, jadi tenant bebas me-rename varian — ketidakcocokan nama muncul
 * sebagai info, bukan error merah.
 */
import type { InventoryPriceImportResult } from "@marketplaceindo/shared";

const props = defineProps<{ tenantId: string }>();
const emit = defineEmits<{ tutup: []; selesai: [InventoryPriceImportResult] }>();

const { priceFileUrl, importPrices } = useCatalog();

const langkah = ref<"unduh" | "unggah" | "hasil">("unduh");
const berkas = ref<File | null>(null);
const busy = ref(false);
const error = ref("");
const hasil = ref<InventoryPriceImportResult | null>(null);

const unduhUrl = computed(() => priceFileUrl(props.tenantId));

function pilihBerkas(event: Event) {
  const input = event.target as HTMLInputElement;
  berkas.value = input.files?.[0] ?? null;
  error.value = "";
}

async function unggah() {
  if (!berkas.value) return;
  busy.value = true;
  error.value = "";
  try {
    const result = await importPrices(props.tenantId, berkas.value);
    hasil.value = result;
    langkah.value = "hasil";
    emit("selesai", result);
  } catch (err) {
    error.value = apiErrorOf(err).message;
  } finally {
    busy.value = false;
  }
}

/** `name_mismatch` adalah info: harga tetap diterapkan, jadi jangan merah. */
const GAYA_WARNING: Record<string, string> = {
  name_mismatch: "bg-slate-50 text-slate-600",
  no_change: "bg-slate-50 text-slate-500",
  variant_not_found: "bg-amber-50 text-amber-900",
  price_invalid: "bg-amber-50 text-amber-900",
};
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="judul-harga-massal"
  >
    <div class="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-lg sm:rounded-2xl">
      <div class="flex items-start justify-between gap-4">
        <h2 id="judul-harga-massal" class="text-lg font-semibold text-slate-900">
          Perbarui harga lewat Excel
        </h2>
        <button type="button" class="text-sm text-slate-500" @click="emit('tutup')">Tutup</button>
      </div>

      <!-- Langkah 1: unduh -->
      <template v-if="langkah === 'unduh'">
        <p class="mt-3 text-sm text-slate-600">
          Unduh daftar harga saat ini, ubah <strong>hanya kolom Harga</strong>, lalu unggah
          kembali. Jangan menghapus baris atau kolom — kolom pertama dipakai untuk mencocokkan
          varian.
        </p>
        <a
          :href="unduhUrl"
          class="mt-4 block w-full rounded-lg bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white"
          download
        >
          Unduh daftar harga
        </a>
        <button
          type="button"
          class="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          @click="langkah = 'unggah'"
        >
          Sudah diubah — lanjut unggah
        </button>
      </template>

      <!-- Langkah 2: unggah -->
      <template v-else-if="langkah === 'unggah'">
        <p class="mt-3 text-sm text-slate-600">Pilih file yang sudah kamu ubah.</p>
        <input
          type="file"
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          class="mt-4 w-full rounded-lg border border-slate-300 p-3 text-sm"
          aria-label="File harga"
          @change="pilihBerkas"
        />
        <p v-if="error" class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ error }}
        </p>
        <button
          type="button"
          :disabled="!berkas || busy"
          class="mt-4 w-full rounded-lg bg-teal-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          @click="unggah"
        >
          {{ busy ? "Mengunggah…" : "Unggah dan perbarui" }}
        </button>
        <button
          type="button"
          class="mt-2 w-full text-sm text-slate-500"
          @click="langkah = 'unduh'"
        >
          &larr; Kembali
        </button>
      </template>

      <!-- Langkah 3: hasil per baris -->
      <template v-else-if="hasil">
        <p class="mt-3 text-sm text-slate-700">
          <strong>{{ hasil.updated }}</strong> harga diperbarui ·
          <strong>{{ hasil.skipped }}</strong> dilewati.
        </p>

        <ul v-if="hasil.warnings.length" class="mt-3 space-y-2">
          <li
            v-for="(w, i) in hasil.warnings"
            :key="i"
            class="rounded-lg px-3 py-2 text-sm"
            :class="GAYA_WARNING[w.kind] ?? 'bg-slate-50 text-slate-600'"
          >
            <span class="font-medium">Baris {{ w.row }}</span> — {{ w.message }}
          </li>
        </ul>
        <p v-else class="mt-3 text-sm text-slate-500">Tidak ada catatan. Semua baris bersih.</p>

        <button
          type="button"
          class="mt-4 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          @click="emit('tutup')"
        >
          Selesai
        </button>
      </template>
    </div>
  </div>
</template>
