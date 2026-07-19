<script setup lang="ts">
import type { Block, Vehicle } from "@marketplaceindo/shared";
import VehicleCard from "./VehicleCard.vue";

type Data = Extract<Block, { type: "featured_vehicles" }>["data"];
const props = defineProps<{ data: Data }>();

const requestFetch = useRequestFetch();
const route = useRoute();

// Render API belum punya endpoint multi-slug — ambil list lalu saring
// (fixture mock kecil; Fase 5 beralih ke fetch per-slug VDP bila perlu).
const { data: result } = await useAsyncData(
  () => `featured-vehicles:${props.data.vehicleSlugs.join(",")}`,
  () =>
    requestFetch<{ items: Vehicle[]; nextCursor: string | null }>("/api/_render/vehicles", {
      query: { limit: "100", ...(route.query.preview === "1" ? { preview: "1" } : {}) },
    }),
);

const items = computed(() => {
  const bySlug = new Map((result.value?.items ?? []).map((v) => [v.slug, v]));
  return props.data.vehicleSlugs
    .map((slug) => bySlug.get(slug))
    .filter((v): v is Vehicle => v !== undefined);
});
</script>

<template>
  <div v-if="items.length" class="section-inner py-8 md:py-12">
    <h2 v-if="data.heading" class="mb-6 text-2xl font-bold md:text-3xl">
      {{ data.heading }}
    </h2>
    <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <VehicleCard
        v-for="vehicle in items"
        :key="vehicle.id"
        :vehicle="vehicle"

      />
    </ul>
  </div>
</template>
