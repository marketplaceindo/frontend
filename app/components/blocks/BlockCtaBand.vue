<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "cta_band" }>["data"];
defineProps<{ data: Data }>();
</script>

<template>
  <div class="section-inner py-8 md:py-12">
    <div class="rounded-theme bg-primary p-8 text-center text-white md:p-12">
      <h2 class="text-2xl font-bold md:text-3xl">{{ data.heading }}</h2>
      <p v-if="data.subheading" class="mt-3 opacity-90">{{ data.subheading }}</p>
      <!-- Band sudah ber-bg primary → tombol dibalik (bg putih, teks primary). -->
      <a
        :href="data.cta.href"
        class="mt-6 inline-block rounded-theme bg-white px-6 py-3 text-sm font-semibold text-primary transition-opacity hover:opacity-85"
      >
        {{ data.cta.label }}
      </a>
    </div>
  </div>
</template>
