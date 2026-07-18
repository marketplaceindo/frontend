<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";
import BlockImage from "./BlockImage.vue";

type Data = Extract<Block, { type: "about" }>["data"];
defineProps<{ data: Data }>();
</script>

<template>
  <div class="section-inner grid items-center gap-8 py-8 md:grid-cols-2 md:py-12">
    <div>
      <h2 v-if="data.heading" class="text-2xl font-bold md:text-3xl">
        {{ data.heading }}
      </h2>
      <p class="mt-4 leading-relaxed whitespace-pre-line opacity-90">
        {{ data.body }}
      </p>
    </div>
    <div v-if="data.image" class="aspect-square overflow-hidden rounded-theme md:aspect-[4/3]">
      <BlockImage :image="data.image" />
    </div>
  </div>
</template>
