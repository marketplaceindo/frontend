<script setup lang="ts">
import type { VehicleUnit } from "@marketplaceindo/shared";

/** Kartu unit dipakai unit_grid dan listing /mobil-bekas. */
defineProps<{ unit: VehicleUnit }>();

const { tautan } = useTenantLink();

const TRANSMISSION_LABELS: Record<string, string> = {
  manual: "Manual",
  automatic: "Matic",
  cvt: "CVT",
};
</script>

<template>
  <li
    class="mi-card mi-card-link flex flex-col"
    :class="unit.sold ? 'mi-card-sold' : ''"
    :data-unit="unit.slug"
  >
    <NuxtLink :to="tautan(`/mobil-bekas/${unit.slug}`)" class="flex flex-1 flex-col no-underline">
      <!-- Foto unit butuh resolusi mediaId → URL (backend media, Fase 7). -->
      <div class="mi-card-media relative aspect-video">
        <span v-if="unit.sold" class="mi-badge mi-badge-overlay absolute top-2.5 left-2.5">
          Terjual
        </span>
      </div>
      <div class="flex flex-1 flex-col p-4">
        <h3 class="text-base font-semibold">{{ unit.name }}</h3>

        <!-- Tahun/transmisi/kilometer jadi chip terpisah: di mobil bekas ini
             kriteria saring utama, bukan keterangan tambahan. -->
        <ul class="mt-2.5 flex flex-wrap gap-1.5">
          <li class="mi-spec-pill">{{ unit.year }}</li>
          <li v-if="unit.transmission" class="mi-spec-pill">
            {{ TRANSMISSION_LABELS[unit.transmission] }}
          </li>
          <li v-if="unit.mileageKm !== undefined" class="mi-spec-pill">
            {{ unit.mileageKm.toLocaleString("id-ID") }} km
          </li>
        </ul>

        <div class="mt-auto pt-4">
          <p class="text-lg font-bold text-primary">{{ formatRupiah(unit.price) }}</p>
          <span class="mt-1 inline-block text-sm font-semibold text-primary">Lihat detail →</span>
        </div>
      </div>
    </NuxtLink>
  </li>
</template>
