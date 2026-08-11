<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";
import BlockImage from "./BlockImage.vue";

type Data = Extract<Block, { type: "services" }>["data"];
defineProps<{ data: Data }>();

const { tautan } = useTenantLink();
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
        class="overflow-hidden rounded-theme border border-text/10"
        :class="item.href ? 'transition-shadow hover:shadow-md' : ''"
      >
        <component
          :is="item.href ? 'a' : 'div'"
          :href="item.href ? tautan(item.href) : undefined"
          class="block no-underline"
        >
          <div v-if="item.image" class="aspect-video">
            <BlockImage :image="item.image" />
          </div>
          <div class="p-5">
            <h3 class="font-semibold">{{ item.name }}</h3>
            <p v-if="item.description" class="mt-1 text-sm opacity-80">{{ item.description }}</p>
            <p v-if="item.price !== undefined" class="mt-3 font-semibold text-primary">
              {{ formatRupiah(item.price) }}
            </p>
            <span
              v-if="item.href"
              class="mt-3 inline-block text-sm font-semibold text-primary"
            >Lihat detail →</span>
          </div>
        </component>
      </li>
    </ul>
  </div>
</template>
