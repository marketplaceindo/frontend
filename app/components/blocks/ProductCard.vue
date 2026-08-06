<script setup lang="ts">
import type { Product } from "@marketplaceindo/shared";

/** Kartu produk dipakai product_grid dan listing /produk. */
defineProps<{ product: Product }>();

const { tautan } = useTenantLink();
</script>

<template>
  <li
    class="mi-card mi-card-link flex flex-col"
    :class="product.inStock === false ? 'mi-card-sold' : ''"
    :data-product="product.slug"
  >
    <NuxtLink :to="tautan(`/produk/${product.slug}`)" class="flex flex-1 flex-col no-underline">
      <!-- Foto produk butuh resolusi mediaId → URL (backend media, Fase 7). -->
      <div class="mi-card-media relative aspect-square">
        <span
          v-if="product.inStock === false"
          class="mi-badge mi-badge-overlay absolute top-2.5 left-2.5"
        >
          Stok habis
        </span>
      </div>
      <div class="flex flex-1 flex-col p-3.5">
        <p v-if="product.category" class="mi-eyebrow">{{ product.category }}</p>
        <h3 class="mt-1 text-sm leading-snug font-medium">{{ product.name }}</h3>
        <p class="mt-auto pt-3 font-bold text-primary">{{ formatRupiah(product.price) }}</p>
      </div>
    </NuxtLink>
  </li>
</template>
