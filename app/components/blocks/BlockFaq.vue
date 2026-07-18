<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "faq" }>["data"];
defineProps<{ data: Data }>();
</script>

<template>
  <div class="section-inner max-w-3xl py-8 md:py-12">
    <h2 v-if="data.heading" class="mb-4 text-2xl font-bold md:text-3xl">
      {{ data.heading }}
    </h2>
    <!-- details/summary native: tanpa JS, keyboard-accessible. -->
    <details
      v-for="(item, i) in data.items"
      :key="i"
      class="group border-b border-text/10 py-3"
    >
      <summary class="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
        {{ item.question }}
        <span class="transition-transform group-open:rotate-45" aria-hidden="true">+</span>
      </summary>
      <p class="mt-2 text-sm leading-relaxed whitespace-pre-line opacity-90">
        {{ item.answer }}
      </p>
    </details>
  </div>
</template>
