<script setup lang="ts">
/**
 * Unit pilihan (addendum §Fase 4). Sejak D-01 block ini menunjuk **model**
 * (opsional varian tertentu), bukan unit fisik — `items: {modelSlug, variantSlug?}`.
 * Harga yang tampil adalah "mulai dari" di kota aktif.
 */
import type { Block, RenderModelCard, RenderModelsResponse } from "@marketplaceindo/shared";
import ModelCard from "./ModelCard.vue";

type Data = Extract<Block, { type: "featured_vehicles" }>["data"];
const props = defineProps<{ data: Data }>();

const requestFetch = useRequestFetch();
const route = useRoute();
const kota = useKotaAktif();

// Render API belum punya endpoint multi-slug — ambil daftar lalu saring
// mengikuti urutan yang ditulis tenant di block.
const { data: result } = await useAsyncData(
  () => `featured-models:${props.data.items.map((i) => i.modelSlug).join(",")}:${kota.value}`,
  () =>
    requestFetch<RenderModelsResponse>("/api/_render/models", {
      query: {
        limit: "100",
        ...(kota.value ? { city: kota.value } : {}),
        ...(route.query.preview === "1" ? { preview: "1" } : {}),
      },
    }),
);

interface Entry {
  model: RenderModelCard;
  variantSlug?: string;
}

const items = computed<Entry[]>(() => {
  const bySlug = new Map((result.value?.items ?? []).map((m) => [m.slug, m]));
  const out: Entry[] = [];
  for (const ref of props.data.items) {
    const model = bySlug.get(ref.modelSlug);
    if (!model) continue;
    // Varian eksplisit → kartu menautkan langsung ke VDP varian itu.
    out.push(ref.variantSlug ? { model, variantSlug: ref.variantSlug } : { model });
  }
  return out;
});
</script>

<template>
  <div v-if="items.length" class="section-inner py-8 md:py-12">
    <h2 v-if="data.heading" class="mb-6 text-2xl font-bold md:text-3xl">
      {{ data.heading }}
    </h2>
    <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ModelCard
        v-for="entry in items"
        :key="entry.model.slug"
        :model="entry.model"
        :variant-slug="entry.variantSlug"
      />
    </ul>
  </div>
</template>
