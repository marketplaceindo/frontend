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
  <!-- Sapuan warna lembut dari token tenant: memberi kedalaman pada bagian
       paling atas halaman tanpa menambah satu pun warna di luar tema. -->
  <div class="mi-wash relative">
    <div class="section-inner flex flex-col gap-8 py-12 md:py-20" :class="alignClass">
      <div class="max-w-2xl">
        <h1 class="text-[2rem] leading-[1.1] font-bold text-balance md:text-5xl lg:text-6xl">
          {{ data.heading }}
        </h1>
        <p
          v-if="data.subheading"
          class="mt-5 text-base leading-relaxed text-pretty md:text-lg"
          style="color: var(--color-muted)"
        >
          {{ data.subheading }}
        </p>
        <div
          v-if="data.ctas?.length"
          class="mt-8 flex flex-wrap gap-3"
          :class="data.align === 'right' ? 'justify-end' : data.align === 'left' ? 'justify-start' : 'justify-center'"
        >
          <a
            v-for="cta in data.ctas"
            :key="cta.href"
            :href="tautan(cta.href)"
            :class="[ctaClass(cta.variant), 'px-6 py-3 text-base']"
          >
            {{ cta.label }}
          </a>
        </div>
      </div>
      <!-- Gambar hero = kandidat LCP → eager + fetchpriority high. -->
      <div
        v-if="data.image"
        class="mi-hero-media aspect-video w-full overflow-hidden"
      >
        <BlockImage :image="data.image" eager />
      </div>
    </div>
  </div>
</template>
