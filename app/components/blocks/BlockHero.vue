<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";
import BlockImage from "./BlockImage.vue";

type Data = Extract<Block, { type: "hero" }>["data"];
const props = defineProps<{ data: Data }>();

const { tautan } = useTenantLink();

const alignClass = computed(() => {
  switch (props.data.align) {
    case "left": return "text-left items-start";
    case "right": return "text-right items-end";
    default: return "text-center items-center";
  }
});
</script>

<template>
  <div class="section-inner flex flex-col gap-6 py-8 md:py-14" :class="alignClass">
    <div class="max-w-2xl">
      <h1 class="text-3xl leading-tight font-bold md:text-5xl">
        {{ data.heading }}
      </h1>
      <p v-if="data.subheading" class="mt-4 text-base opacity-80 md:text-lg">
        {{ data.subheading }}
      </p>
      <div
        v-if="data.ctas?.length"
        class="mt-6 flex flex-wrap gap-3"
        :class="data.align === 'right' ? 'justify-end' : data.align === 'left' ? 'justify-start' : 'justify-center'"
      >
        <a v-for="cta in data.ctas" :key="cta.href" :href="tautan(cta.href)" :class="ctaClass(cta.variant)">
          {{ cta.label }}
        </a>
      </div>
    </div>
    <!-- Gambar hero = kandidat LCP → eager + fetchpriority high. -->
    <div v-if="data.image" class="aspect-video w-full overflow-hidden rounded-theme">
      <BlockImage :image="data.image" eager />
    </div>
  </div>
</template>
