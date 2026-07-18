<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "contact" }>["data"];
const props = defineProps<{ data: Data }>();

// Guard injection: hanya embed resmi Google Maps yang boleh masuk iframe.
const safeMapUrl = computed(() => {
  const url = props.data.mapEmbedUrl;
  return url && url.startsWith("https://www.google.com/maps/embed") ? url : null;
});

// TODO(Fase 4): data.showForm → form lead (POST /api/leads, schema shared).
</script>

<template>
  <div class="section-inner py-8 md:py-12">
    <h2 v-if="data.heading" class="mb-6 text-2xl font-bold md:text-3xl">
      {{ data.heading }}
    </h2>
    <div class="grid gap-8 md:grid-cols-2">
      <address class="space-y-3 text-sm not-italic">
        <p v-if="data.address" class="leading-relaxed whitespace-pre-line">
          {{ data.address }}
        </p>
        <p v-if="data.whatsapp">
          <a :href="`https://wa.me/${data.whatsapp}`" rel="noopener" class="font-medium">
            WhatsApp: +{{ data.whatsapp }}
          </a>
        </p>
        <p v-if="data.email">
          <a :href="`mailto:${data.email}`" class="font-medium">{{ data.email }}</a>
        </p>
      </address>
      <iframe
        v-if="safeMapUrl"
        :src="safeMapUrl"
        title="Peta lokasi"
        class="aspect-[4/3] w-full rounded-theme border-0"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        allowfullscreen
      />
    </div>
  </div>
</template>
