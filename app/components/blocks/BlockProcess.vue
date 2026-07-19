<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "process" }>["data"];
defineProps<{ data: Data }>();
</script>

<template>
  <div class="section-inner py-8 md:py-12">
    <h2 v-if="data.heading" class="mb-6 text-2xl font-bold md:text-3xl">
      {{ data.heading }}
    </h2>
    <ol class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <li v-for="(step, i) in data.steps" :key="i" class="flex gap-4">
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white"
          aria-hidden="true"
        >
          {{ i + 1 }}
        </span>
        <span>
          <h3 class="font-semibold">{{ step.title }}</h3>
          <p v-if="step.description" class="mt-1 text-sm opacity-80">{{ step.description }}</p>
        </span>
      </li>
    </ol>
  </div>
</template>
