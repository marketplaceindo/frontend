<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "navbar" }>["data"];
defineProps<{ data: Data }>();
</script>

<template>
  <nav
    class="border-b border-text/10 bg-bg/95 backdrop-blur"
    :class="data.sticky ? 'sticky top-0 z-40' : ''"
    aria-label="Navigasi halaman"
  >
    <div class="section-inner flex gap-x-5 overflow-x-auto py-3 whitespace-nowrap">
      <a
        v-for="link in data.links"
        :key="link.href"
        :href="link.href"
        class="text-sm font-medium"
      >
        {{ link.label }}
      </a>
    </div>
  </nav>
</template>
