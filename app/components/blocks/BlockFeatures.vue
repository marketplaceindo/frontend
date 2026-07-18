<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "features" }>["data"];
defineProps<{ data: Data }>();
</script>

<template>
  <div class="section-inner py-8 md:py-12">
    <h2 v-if="data.heading" class="mb-6 text-2xl font-bold md:text-3xl">
      {{ data.heading }}
    </h2>
    <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li
        v-for="(item, i) in data.items"
        :key="i"
        class="rounded-theme border border-text/10 p-5"
      >
        <span v-if="item.icon" class="text-2xl" aria-hidden="true">{{ item.icon }}</span>
        <h3 class="mt-2 font-semibold">{{ item.title }}</h3>
        <p v-if="item.description" class="mt-1 text-sm opacity-80">
          {{ item.description }}
        </p>
      </li>
    </ul>
  </div>
</template>
