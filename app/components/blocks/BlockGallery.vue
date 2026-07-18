<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";
import BlockImage from "./BlockImage.vue";

type Data = Extract<Block, { type: "gallery" }>["data"];
defineProps<{ data: Data }>();
</script>

<template>
  <div class="section-inner py-8 md:py-12">
    <h2 v-if="data.heading" class="mb-6 text-2xl font-bold md:text-3xl">
      {{ data.heading }}
    </h2>
    <ul class="grid grid-cols-2 gap-3 md:grid-cols-3">
      <li
        v-for="(image, i) in data.images"
        :key="i"
        class="aspect-square overflow-hidden rounded-theme"
      >
        <BlockImage :image="image" />
      </li>
    </ul>
  </div>
</template>
