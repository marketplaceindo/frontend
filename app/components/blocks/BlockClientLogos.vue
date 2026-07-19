<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";
import BlockImage from "./BlockImage.vue";

type Data = Extract<Block, { type: "client_logos" }>["data"];
defineProps<{ data: Data }>();
</script>

<template>
  <div class="section-inner py-8 md:py-10">
    <h2 v-if="data.heading" class="mb-6 text-center text-sm font-semibold tracking-wide uppercase opacity-70">
      {{ data.heading }}
    </h2>
    <ul class="flex flex-wrap items-center justify-center gap-8">
      <li v-for="(logo, i) in data.logos" :key="i" class="h-10 w-28 opacity-70 grayscale">
        <BlockImage :image="logo" contain />
      </li>
    </ul>
  </div>
</template>
