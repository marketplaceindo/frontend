<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";
import BlockImage from "./BlockImage.vue";

type Data = Extract<Block, { type: "product_categories" }>["data"];
defineProps<{ data: Data }>();
</script>

<template>
  <div class="section-inner py-8 md:py-12">
    <h2 v-if="data.heading" class="mb-6 text-2xl font-bold md:text-3xl">
      {{ data.heading }}
    </h2>
    <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <li
        v-for="(category, i) in data.categories"
        :key="i"
        class="relative overflow-hidden rounded-theme border border-text/10"
      >
        <div class="aspect-square bg-text/5">
          <BlockImage v-if="category.image" :image="category.image" />
        </div>
        <p class="p-3 text-center text-sm font-semibold">{{ category.name }}</p>
      </li>
    </ul>
  </div>
</template>
