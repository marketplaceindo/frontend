<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "reservation" }>["data"];
const props = defineProps<{ data: Data }>();

const waHref = computed(() =>
  props.data.whatsapp
    ? `https://wa.me/${props.data.whatsapp}?text=${encodeURIComponent("Halo, saya mau reservasi.")}`
    : null,
);
</script>

<template>
  <div class="section-inner max-w-xl py-8 text-center md:py-12">
    <h2 v-if="data.heading" class="text-2xl font-bold md:text-3xl">{{ data.heading }}</h2>
    <p v-if="data.description" class="mt-3 text-sm leading-relaxed opacity-80">
      {{ data.description }}
    </p>
    <a v-if="waHref" :href="waHref" rel="noopener" target="_blank" :class="ctaClass('primary')" class="mt-5">
      Reservasi via WhatsApp
    </a>
  </div>
</template>
