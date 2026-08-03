<script setup lang="ts">
/**
 * Indikator provenance varian di editor (§4.2, keputusan D-11).
 *
 * Ini yang menentukan apakah tenant memercayai data seed atau menghapus
 * semuanya. Nadanya karena itu **netral dan informatif**, bukan peringatan —
 * kecuali untuk dua hal yang memang berisiko: harga estimasi (D-14) dan harga
 * yang sudah lama tidak disentuh.
 */
import type { PriceSource } from "@marketplaceindo/shared";

const props = defineProps<{
  /** Nama merk asal katalog; kosong = varian diinput manual. */
  brand?: string;
  priceSource?: PriceSource;
  priceUpdatedAt?: string;
  priceEstimated?: boolean;
  priceEstimatedFromCity?: string;
  /** `now` bisa disuntik agar test tidak bergantung jam berjalan. */
  now?: string;
}>();

/** Ambang harga dianggap basi. Di bawah ini badge tetap netral. */
const HARI_KEDALUWARSA = 90;

const dariKatalog = computed(() => props.priceSource === "catalog");

const umurHari = computed<number | null>(() => {
  if (!props.priceUpdatedAt) return null;
  const dari = new Date(props.priceUpdatedAt).getTime();
  const sampai = props.now ? new Date(props.now).getTime() : Date.now();
  if (Number.isNaN(dari) || Number.isNaN(sampai)) return null;
  return Math.floor((sampai - dari) / 86_400_000);
});

const labelUmur = computed(() => {
  const hari = umurHari.value;
  if (hari === null) return "";
  if (hari <= 0) return "harga diperbarui hari ini";
  if (hari === 1) return "harga diperbarui kemarin";
  if (hari < 30) return `harga diperbarui ${hari} hari lalu`;
  const bulan = Math.floor(hari / 30);
  return `harga diperbarui ${bulan} bulan lalu`;
});

const hargaBasi = computed(() => (umurHari.value ?? 0) > HARI_KEDALUWARSA);
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5 text-xs">
    <span
      v-if="dariKatalog"
      class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600"
      data-badge="katalog"
    >
      Dari katalog<template v-if="brand"> {{ brand }}</template>
    </span>

    <span
      v-else-if="priceSource === 'excel'"
      class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600"
      data-badge="excel"
    >
      Diperbarui lewat Excel
    </span>

    <span
      v-if="labelUmur"
      class="rounded-full px-2 py-0.5"
      :class="hargaBasi ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600'"
      data-badge="umur-harga"
    >
      {{ labelUmur }}
    </span>

    <!--
      Estimasi selalu berwarna peringatan: angka ini BUKAN OTR kota tenant, dan
      tenant harus melihatnya sebelum memublikasikan.
    -->
    <span
      v-if="priceEstimated"
      class="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900"
      data-badge="estimasi"
    >
      Estimasi<template v-if="priceEstimatedFromCity"> (harga {{ priceEstimatedFromCity }})</template>
    </span>
  </div>
</template>
