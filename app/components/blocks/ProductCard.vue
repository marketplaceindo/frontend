<script setup lang="ts">
import type { Product } from "@marketplaceindo/shared";

/** Kartu produk dipakai product_grid dan listing /produk. */
defineProps<{ product: Product }>();
</script>

<template>
  <li class="overflow-hidden rounded-theme border border-text/10" :data-product="product.slug">
    <NuxtLink :to="`/produk/${product.slug}`" class="block">
      <!-- Foto produk butuh resolusi mediaId → URL (backend media, Fase 7). -->
      <div class="aspect-square bg-text/5" />
      <div class="p-3">
        <h3 class="text-sm font-medium">{{ product.name }}</h3>
        <p v-if="product.category" class="text-xs opacity-60">{{ product.category }}</p>
        <p class="mt-1 font-semibold text-primary">{{ formatRupiah(product.price) }}</p>
        <p v-if="product.inStock === false" class="mt-1 text-xs text-secondary">Stok habis</p>
      </div>
    </NuxtLink>
  </li>
</template>
