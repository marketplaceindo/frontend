<script setup lang="ts">
import type { RenderPageResponse } from "@marketplaceindo/shared";

/**
 * Iterasi sections sesuai `order`, render tiap block via blockMap.
 * Wrapper .section-shell membawa Level 3 cascade (styleJson → CSS vars);
 * tipe block tak dikenal jatuh ke BlockUnknown (render null).
 */
const props = defineProps<{ sections: RenderPageResponse["sections"] }>();

const sorted = computed(() =>
  [...props.sections].sort((a, b) => a.order - b.order),
);
</script>

<template>
  <section
    v-for="section in sorted"
    :key="section.sectionKey"
    :data-section="section.sectionKey"
    class="section-shell"
    :style="sectionStyleToCss(section.styleJson)"
  >
    <component
      :is="resolveBlock(block.type)"
      v-for="(block, i) in section.blocks"
      :key="`${section.sectionKey}-${i}`"
      :data="block.data"
      :block-type="block.type"
    />
  </section>
</template>
