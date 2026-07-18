<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "stats" }>["data"];
defineProps<{ data: Data }>();
</script>

<template>
  <div class="section-inner py-8 md:py-12">
    <dl class="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
      <div v-for="(item, i) in data.items" :key="i">
        <dd class="text-3xl font-bold text-primary md:text-4xl">{{ item.value }}</dd>
        <dt class="mt-1 text-sm opacity-75">{{ item.label }}</dt>
      </div>
    </dl>
  </div>
</template>
