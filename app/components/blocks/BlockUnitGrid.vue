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
    <div v-if="data.heading" class="mi-section-head">
      <p class="mi-eyebrow">Unit Unggulan</p>
      <h2 class="mt-1.5 text-2xl font-bold text-balance md:text-3xl">{{ data.heading }}</h2>
    </div>
    <ul v-if="items.length" class="mi-grid">
      <UnitCard v-for="unit in items" :key="unit.id" :unit="unit" />
    </ul>
    <p v-else class="mi-empty">Belum ada unit tersedia.</p>
  </div>
</template>
