<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";
import BlockImage from "./BlockImage.vue";

type Data = Extract<Block, { type: "team" }>["data"];
defineProps<{ data: Data }>();
</script>

<template>
  <div class="section-inner py-8 md:py-12">
    <h2 v-if="data.heading" class="mb-6 text-2xl font-bold md:text-3xl">
      {{ data.heading }}
    </h2>
    <ul class="grid grid-cols-2 gap-6 text-center sm:grid-cols-3 lg:grid-cols-4">
      <li v-for="(member, i) in data.members" :key="i">
        <span class="mx-auto block h-24 w-24 overflow-hidden rounded-full bg-text/10">
          <BlockImage v-if="member.photo" :image="member.photo" />
        </span>
        <h3 class="mt-3 text-sm font-semibold">{{ member.name }}</h3>
        <p v-if="member.role" class="text-xs opacity-70">{{ member.role }}</p>
      </li>
    </ul>
  </div>
</template>
