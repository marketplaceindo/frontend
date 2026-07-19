<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "simulasi_kredit" }>["data"];
const props = defineProps<{ data: Data }>();

// Konfigurasi datang dari data block (bungaDefault, tenorOptions, metodeDefault,
// dpMin); logika hitung di app/utils/kredit.ts (teruji unit).
const harga = ref(200_000_000);
const dpPersen = ref(Math.max(props.data.dpMin, 20));
const tenor = ref(props.data.tenorOptions[0] ?? 12);
const metode = ref<"flat" | "efektif">(props.data.metodeDefault);
const bunga = ref(props.data.bungaDefault);

const hasil = computed(() => {
  try {
    return hitungKredit({
      harga: harga.value,
      dpPersen: dpPersen.value,
      tenorBulan: tenor.value,
      bungaTahunanPersen: bunga.value,
      metode: metode.value,
    });
  } catch {
    return null;
  }
});

const dpInvalid = computed(() => dpPersen.value < props.data.dpMin);
</script>

<template>
  <div class="section-inner max-w-2xl py-8 md:py-12">
    <h2 class="mb-6 text-2xl font-bold md:text-3xl">Simulasi Kredit</h2>

    <form class="grid gap-4 sm:grid-cols-2" @submit.prevent>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">Harga unit (Rp)</span>
        <input
          v-model.number="harga"
          type="number"
          min="1000000"
          step="1000000"
          class="w-full rounded-theme border border-text/20 bg-bg px-3 py-2"
        />
      </label>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">Uang muka (%) — min. {{ data.dpMin }}%</span>
        <input
          v-model.number="dpPersen"
          type="number"
          :min="data.dpMin"
          max="90"
          class="w-full rounded-theme border border-text/20 bg-bg px-3 py-2"
          :aria-invalid="dpInvalid"
        />
        <span v-if="dpInvalid" class="mt-1 block text-xs text-secondary">
          DP minimal {{ data.dpMin }}% dari harga.
        </span>
      </label>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">Tenor</span>
        <select v-model.number="tenor" class="w-full rounded-theme border border-text/20 bg-bg px-3 py-2">
          <option v-for="t in data.tenorOptions" :key="t" :value="t">{{ t }} bulan</option>
        </select>
      </label>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">Metode bunga ({{ bunga }}%/tahun)</span>
        <select v-model="metode" class="w-full rounded-theme border border-text/20 bg-bg px-3 py-2">
          <option value="flat">Flat</option>
          <option value="efektif">Efektif (anuitas)</option>
        </select>
      </label>
    </form>

    <dl v-if="hasil && !dpInvalid" class="mt-6 rounded-theme border border-text/10 p-5" data-testid="hasil-kredit">
      <div class="flex justify-between py-1 text-sm">
        <dt>Uang muka</dt>
        <dd class="font-medium">{{ formatRupiah(hasil.uangMuka) }}</dd>
      </div>
      <div class="flex justify-between py-1 text-sm">
        <dt>Pokok hutang</dt>
        <dd class="font-medium">{{ formatRupiah(hasil.pokokHutang) }}</dd>
      </div>
      <div class="flex justify-between border-t border-text/10 py-2">
        <dt class="font-semibold">Angsuran/bulan ({{ metode === "flat" ? "flat" : "anuitas" }})</dt>
        <dd class="text-lg font-bold text-primary">{{ formatRupiah(hasil.angsuranPerBulan) }}</dd>
      </div>
      <div class="flex justify-between py-1 text-sm opacity-80">
        <dt>Total bunga {{ tenor }} bulan</dt>
        <dd>{{ formatRupiah(hasil.totalBunga) }}</dd>
      </div>
    </dl>

    <p class="mt-4 text-xs leading-relaxed opacity-70">
      Estimasi metode {{ metode === "flat" ? "bunga flat" : "bunga efektif (anuitas)" }},
      belum termasuk biaya asuransi, administrasi, provisi, dan fidusia.
      Angka final mengikuti perhitungan perusahaan pembiayaan.
    </p>
  </div>
</template>
