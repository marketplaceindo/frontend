<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "price_list" }>["data"];
defineProps<{ data: Data }>();
</script>

<template>
  <div class="section-inner max-w-3xl py-8 md:py-12">
    <h2 v-if="data.heading" class="mb-6 text-2xl font-bold md:text-3xl">
      {{ data.heading }}
    </h2>
    <div v-for="(group, gi) in data.groups" :key="gi" class="mb-8 last:mb-0">
      <h3 v-if="group.title" class="mb-3 font-semibold">{{ group.title }}</h3>
      <ul class="divide-y divide-text/10 rounded-theme border border-text/10">
        <li v-for="(item, i) in group.items" :key="i" class="flex items-baseline justify-between gap-4 p-4">
          <span>
            <span class="font-medium">{{ item.name }}</span>
            <span v-if="item.description" class="block text-sm opacity-70">{{ item.description }}</span>
          </span>
          <span class="shrink-0 font-semibold text-primary">{{ formatRupiah(item.price) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
