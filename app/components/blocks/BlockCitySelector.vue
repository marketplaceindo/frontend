<script setup lang="ts">
/**
 * Selector kota (D-03). Harga mobil berbeda per kota karena BBN berbeda per
 * provinsi — satu angka tanpa konteks kota membuat sales kehilangan kredibilitas
 * di percakapan pertama.
 *
 * Pilihan bersifat global (state + cookie) sehingga langsung memengaruhi harga
 * di listing, halaman model, VDP, compare, dan simulasi kredit sekaligus.
 */
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "city_selector" }>["data"];
defineProps<{ data: Data }>();

const site = useTenantSite();
const kota = useKotaAktif();

/** Daftar kota dimiliki tenant (settings), bukan platform. */
const cities = computed(() => site.value?.sales?.cities ?? []);

// Tanpa pilihan eksplisit, ikuti kota default tenant.
watchEffect(() => {
  if (!kota.value && site.value?.sales?.defaultCity) kota.value = site.value.sales.defaultCity.code;
});
</script>

<template>
  <div v-if="cities.length > 1" :class="data.tampilan === 'chip' ? '' : 'section-inner py-4'">
    <label class="inline-flex items-center gap-2 text-sm">
      <span class="opacity-80">{{ data.label ?? "Kota" }}</span>
      <select
        v-model="kota"
        class="rounded-theme border border-text/20 bg-bg px-3 py-2 text-sm"
        :aria-label="data.label ?? 'Pilih kota'"
      >
        <option v-for="c in cities" :key="c.code" :value="c.code">{{ c.name }}</option>
      </select>
    </label>
  </div>
</template>
