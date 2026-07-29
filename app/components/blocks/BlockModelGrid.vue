<script setup lang="ts">
/**
 * Grid model mobil baru (addendum §Fase 4). Filter lewat query param SSR supaya
 * tiap kombinasi menghasilkan URL unik yang shareable & crawlable — form GET
 * native, bukan state client.
 */
import type { Block, RenderModelsResponse } from "@marketplaceindo/shared";
import ModelCard from "./ModelCard.vue";

type Data = Extract<Block, { type: "model_grid" }>["data"];
const props = defineProps<{ data: Data }>();

const requestFetch = useRequestFetch();
const route = useRoute();
const kota = useKotaAktif();

const BODY_TYPES = [
  ["mpv", "MPV"],
  ["suv", "SUV"],
  ["sedan", "Sedan"],
  ["hatchback", "Hatchback"],
  ["pickup", "Pikap"],
  ["lcgc", "LCGC"],
  ["van", "Van"],
  ["wagon", "Wagon"],
] as const;

const query = computed(() => ({
  limit: String(props.data.limit ?? 12),
  ...(props.data.brand ? { brand: props.data.brand } : {}),
  ...(props.data.bodyType ? { body: props.data.bodyType } : {}),
  ...(props.data.sort ? { sort: props.data.sort } : {}),
  ...(kota.value ? { city: kota.value } : {}),
  // Filter dari URL menimpa konfigurasi block (halaman listing /mobil).
  ...(route.query.body ? { body: String(route.query.body) } : {}),
  ...(route.query.brand ? { brand: String(route.query.brand) } : {}),
  ...(route.query.hargaMin ? { hargaMin: String(route.query.hargaMin) } : {}),
  ...(route.query.hargaMax ? { hargaMax: String(route.query.hargaMax) } : {}),
  ...(route.query.preview === "1" ? { preview: "1" } : {}),
}));

const { data: result } = await useAsyncData(
  () => `model-grid:${JSON.stringify(query.value)}`,
  () => requestFetch<RenderModelsResponse>("/api/_render/models", { query: query.value }),
);

const items = computed(() => result.value?.items ?? []);
</script>

<template>
  <div class="section-inner py-8 md:py-12">
    <h2 v-if="data.heading" class="mb-6 text-2xl font-bold md:text-3xl">{{ data.heading }}</h2>

    <!-- Form GET: setiap filter jadi URL sendiri (crawlable + bisa dibagikan) -->
    <form v-if="data.tampilkanFilter" method="get" class="mb-6 flex flex-wrap gap-2">
      <select
        name="body"
        :value="route.query.body ?? ''"
        class="rounded-theme border border-text/20 bg-bg px-3 py-2 text-sm"
        aria-label="Tipe bodi"
      >
        <option value="">Semua tipe</option>
        <option v-for="[value, label] in BODY_TYPES" :key="value" :value="value">{{ label }}</option>
      </select>
      <input
        name="hargaMax"
        type="number"
        step="10000000"
        placeholder="Harga maksimal"
        :value="route.query.hargaMax ?? ''"
        class="rounded-theme border border-text/20 bg-bg px-3 py-2 text-sm"
        aria-label="Harga maksimal"
      />
      <button type="submit" :class="ctaClass('primary')">Terapkan</button>
    </form>

    <ul v-if="items.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ModelCard v-for="model in items" :key="model.slug" :model="model" />
    </ul>
    <p v-else class="text-sm opacity-70">Belum ada model yang cocok dengan filter ini.</p>
  </div>
</template>
