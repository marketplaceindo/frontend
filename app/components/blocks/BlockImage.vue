<script setup lang="ts">
import type { ImageRef } from "@marketplaceindo/shared";

/**
 * Gambar block: lazy-load default (hero pakai eager untuk LCP), decoding async,
 * dimensi dijaga container ber-aspect-ratio (cegah CLS).
 * mediaId tanpa url belum bisa dirender (resolusi URL media = backend, Fase 7).
 */
const props = defineProps<{
  image?: ImageRef;
  eager?: boolean;
}>();

const src = computed(() => props.image?.url ?? null);
</script>

<template>
  <img
    v-if="src"
    :src="src"
    :alt="image?.alt ?? ''"
    :loading="eager ? 'eager' : 'lazy'"
    :fetchpriority="eager ? 'high' : undefined"
    decoding="async"
    class="h-full w-full object-cover"
  />
</template>
