<script setup lang="ts">
import type { VehicleUnit } from "@marketplaceindo/shared";

/** Kartu unit dipakai unit_grid dan listing /mobil-bekas. */
defineProps<{ unit: VehicleUnit }>();

const TRANSMISSION_LABELS: Record<string, string> = {
  manual: "Manual",
  automatic: "Matic",
  cvt: "CVT",
};
</script>

<template>
  <li class="overflow-hidden rounded-theme border border-text/10" :data-unit="unit.slug">
    <NuxtLink :to="`/mobil-bekas/${unit.slug}`" class="block">
      <!-- Foto unit butuh resolusi mediaId → URL (backend media, Fase 7). -->
      <div class="relative aspect-video bg-text/5">
        <span
          v-if="unit.sold"
          class="absolute top-2 left-2 rounded-theme bg-secondary px-2 py-0.5 text-xs font-semibold text-white"
        >
          Terjual
        </span>
      </div>
      <div class="p-4">
        <h3 class="font-semibold">{{ unit.name }}</h3>
        <p class="mt-0.5 text-xs opacity-70">
          {{ unit.year }}
          <template v-if="unit.transmission"> · {{ TRANSMISSION_LABELS[unit.transmission] }}</template>
          <template v-if="unit.mileageKm !== undefined"> · {{ unit.mileageKm.toLocaleString("id-ID") }} km</template>
        </p>
        <p class="mt-2 font-bold text-primary">{{ formatRupiah(unit.price) }}</p>
        <span class="mt-3 inline-block text-sm font-semibold text-primary">Lihat Detail →</span>
      </div>
    </NuxtLink>
  </li>
</template>
