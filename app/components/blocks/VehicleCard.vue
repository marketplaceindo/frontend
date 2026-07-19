<script setup lang="ts">
import type { Vehicle } from "@marketplaceindo/shared";

/**
 * Kartu unit dipakai vehicle_grid & featured_vehicles. CTA sementara deep link
 * WhatsApp ter-prefill nama unit; Fase 5 menggantinya dengan link VDP /mobil/[slug].
 */
const props = defineProps<{ vehicle: Vehicle; whatsapp?: string }>();

const TRANSMISSION_LABELS: Record<string, string> = {
  manual: "Manual",
  automatic: "Matic",
  cvt: "CVT",
};

const waHref = computed(() =>
  props.whatsapp
    ? `https://wa.me/${props.whatsapp}?text=${encodeURIComponent(
        `Halo, saya tertarik dengan ${props.vehicle.name} (${props.vehicle.year}). Apakah masih tersedia?`,
      )}`
    : null,
);
</script>

<template>
  <li class="overflow-hidden rounded-theme border border-text/10" :data-vehicle="vehicle.slug">
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
      <a
        v-if="waHref && !vehicle.sold"
        :href="waHref"
        rel="noopener"
        target="_blank"
        class="mt-3 inline-block text-sm font-semibold"
      >
        Hubungi Sales →
      </a>
    </div>
  </li>
</template>
