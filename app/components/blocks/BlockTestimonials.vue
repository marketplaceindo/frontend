<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";
import BlockImage from "./BlockImage.vue";

type Data = Extract<Block, { type: "testimonials" }>["data"];
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
        <p v-if="item.rating" class="text-accent" :aria-label="`Rating ${item.rating} dari 5`">
          {{ "★".repeat(item.rating) }}<span class="opacity-30">{{ "★".repeat(5 - item.rating) }}</span>
        </p>
        <blockquote class="mt-2 text-sm leading-relaxed italic opacity-90">
          “{{ item.quote }}”
        </blockquote>
        <footer class="mt-4 flex items-center gap-3">
          <span v-if="item.avatar" class="h-10 w-10 shrink-0 overflow-hidden rounded-full">
            <BlockImage :image="item.avatar" />
          </span>
          <span>
            <span class="block text-sm font-semibold">{{ item.name }}</span>
            <span v-if="item.role" class="block text-xs opacity-70">{{ item.role }}</span>
          </span>
        </footer>
      </li>
    </ul>
  </div>
</template>
