<script setup lang="ts">
import type { Vehicle } from "@marketplaceindo/shared";

/** Kartu unit dipakai vehicle_grid, featured_vehicles, dan listing /mobil. */
defineProps<{ vehicle: Vehicle }>();

const TRANSMISSION_LABELS: Record<string, string> = {
  manual: "Manual",
  automatic: "Matic",
  cvt: "CVT",
};
</script>

<template>
  <li class="overflow-hidden rounded-theme border border-text/10" :data-vehicle="vehicle.slug">
    <NuxtLink :to="`/mobil/${vehicle.slug}`" class="block">
      <!-- Foto unit butuh resolusi mediaId → URL (backend media, Fase 7). -->
      <div class="relative aspect-video bg-text/5">
        <span
          v-if="vehicle.sold"
          class="absolute top-2 left-2 rounded-theme bg-secondary px-2 py-0.5 text-xs font-semibold text-white"
        >
          Terjual
        </span>
      </div>
      <div class="p-4">
        <h3 class="font-semibold">{{ vehicle.name }}</h3>
        <p class="mt-0.5 text-xs opacity-70">
          {{ vehicle.year }}
          <template v-if="vehicle.transmission"> · {{ TRANSMISSION_LABELS[vehicle.transmission] }}</template>
          <template v-if="vehicle.mileageKm !== undefined"> · {{ vehicle.mileageKm.toLocaleString("id-ID") }} km</template>
        </p>
        <p class="mt-2 font-bold text-primary">{{ formatRupiah(vehicle.price) }}</p>
        <span class="mt-3 inline-block text-sm font-semibold text-primary">Lihat Detail →</span>
      </div>
    </NuxtLink>
  </li>
</template>
