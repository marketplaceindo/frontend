<script setup lang="ts">
import type { Block, Product } from "@marketplaceindo/shared";
import ProductCard from "./ProductCard.vue";

type Data = Extract<Block, { type: "product_grid" }>["data"];
const props = defineProps<{ data: Data }>();

const requestFetch = useRequestFetch();
const route = useRoute();

const query = computed(() => ({
  limit: String(props.data.limit ?? 8),
  ...(props.data.category ? { category: props.data.category } : {}),
  ...(route.query.preview === "1" ? { preview: "1" } : {}),
}));

const { data: result } = await useAsyncData(
  () => `product-grid:${JSON.stringify(query.value)}`,
  () =>
    requestFetch<{ items: Product[]; nextCursor: string | null }>("/api/_render/products", {
      query: query.value,
    }),
);

// Kontrak §7 tidak punya param sort — urutan pilihan diterapkan pada slice terambil.
const items = computed(() => {
  const list = [...(result.value?.items ?? [])];
  if (props.data.sort === "price_asc") list.sort((a, b) => a.price - b.price);
  else if (props.data.sort === "price_desc") list.sort((a, b) => b.price - a.price);
  return list; // default: newest (urutan API)
});
</script>

<template>
  <div class="section-inner py-8 md:py-12">
    <h2 v-if="data.heading" class="mb-6 text-2xl font-bold md:text-3xl">
      {{ data.heading }}
    </h2>
    <ul v-if="items.length" class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <ProductCard v-for="product in items" :key="product.id" :product="product" />
    </ul>
    <p v-else class="text-sm opacity-70">Belum ada produk.</p>
  </div>
</template>
