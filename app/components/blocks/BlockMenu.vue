<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";
import BlockImage from "./BlockImage.vue";

type Data = Extract<Block, { type: "menu" }>["data"];
defineProps<{ data: Data }>();
</script>

<template>
  <div class="section-inner max-w-3xl py-8 md:py-12">
    <h2 v-if="data.heading" class="mb-6 text-2xl font-bold md:text-3xl">
      {{ data.heading }}
    </h2>
    <div v-for="(group, gi) in data.groups" :key="gi" class="mb-8 last:mb-0">
      <h3 class="mb-3 border-b border-text/10 pb-2 text-lg font-semibold">{{ group.title }}</h3>
      <ul class="space-y-4">
        <li v-for="(item, i) in group.items" :key="i" class="flex gap-4">
          <span v-if="item.image" class="h-16 w-16 shrink-0 overflow-hidden rounded-theme">
            <BlockImage :image="item.image" />
          </span>
          <span class="flex-1">
            <span class="flex items-baseline justify-between gap-3">
              <span class="font-medium">{{ item.name }}</span>
              <span v-if="item.price !== undefined" class="shrink-0 font-semibold text-primary">
                {{ formatRupiah(item.price) }}
              </span>
            </span>
            <span v-if="item.description" class="block text-sm opacity-70">{{ item.description }}</span>
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
