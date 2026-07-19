<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "opening_hours" }>["data"];
defineProps<{ data: Data }>();
</script>

<template>
  <div class="section-inner max-w-xl py-8 md:py-12">
    <h2 v-if="data.heading" class="mb-4 text-2xl font-bold md:text-3xl">
      {{ data.heading }}
    </h2>
    <ul class="divide-y divide-text/10 rounded-theme border border-text/10">
      <li v-for="(row, i) in data.hours" :key="i" class="flex justify-between gap-4 p-3 text-sm">
        <span class="font-medium">{{ row.days }}</span>
        <span class="tabular-nums opacity-80">{{ row.open }}–{{ row.close }}</span>
      </li>
    </ul>
  </div>
</template>
