<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "promo_banner" }>["data"];
const props = defineProps<{ data: Data }>();

const masihBerlaku = computed(
  () => !props.data.until || new Date(props.data.until).getTime() > Date.now(),
);
const untilLabel = computed(() =>
  props.data.until
    ? new Date(props.data.until).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : null,
);
</script>

<template>
  <div v-if="masihBerlaku" class="section-inner py-4">
    <component
      :is="data.href ? 'a' : 'div'"
      :href="data.href"
      class="block rounded-theme bg-accent/15 px-5 py-4 text-center text-sm font-medium"
    >
      {{ data.text }}
      <span v-if="untilLabel" class="opacity-70">— berlaku s.d. {{ untilLabel }}</span>
    </component>
  </div>
</template>
