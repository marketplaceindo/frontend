<script setup lang="ts">
import type { Block, VehicleUnit } from "@marketplaceindo/shared";
import UnitCard from "./UnitCard.vue";

type Data = Extract<Block, { type: "unit_grid" }>["data"];
const props = defineProps<{ data: Data }>();

const requestFetch = useRequestFetch();
const route = useRoute();

const query = computed(() => ({
  limit: String(props.data.limit ?? 8),
  ...(props.data.brand ? { brand: props.data.brand } : {}),
  ...(route.query.preview === "1" ? { preview: "1" } : {}),
}));

const { data: result } = await useAsyncData(
  () => `unit-grid:${JSON.stringify(query.value)}`,
  () =>
    requestFetch<{ items: VehicleUnit[]; nextCursor: string | null }>("/api/_render/units", {
      query: query.value,
    }),
);

// Kontrak §7 tidak punya param sort — urutan pilihan diterapkan pada slice terambil.
const items = computed(() => {
  const list = [...(result.value?.items ?? [])];
  switch (props.data.sort) {
    case "price_asc": list.sort((a, b) => a.price - b.price); break;
    case "price_desc": list.sort((a, b) => b.price - a.price); break;
    case "year_desc": list.sort((a, b) => b.year - a.year); break;
  }
  return list; // default: newest (urutan API)
});
</script>

<template>
  <div class="section-inner py-8 md:py-12">
    <h2 v-if="data.heading" class="mb-6 text-2xl font-bold md:text-3xl">
      {{ data.heading }}
    </h2>
    <ul v-if="items.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UnitCard
        v-for="unit in items"
        :key="unit.id"
        :unit="unit"

      />
    </ul>
    <p v-else class="text-sm opacity-70">Belum ada unit tersedia.</p>
  </div>
</template>
