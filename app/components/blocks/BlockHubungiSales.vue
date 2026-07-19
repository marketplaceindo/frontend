<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "hubungi_sales" }>["data"];
const props = defineProps<{ data: Data }>();

const route = useRoute();

// Deep link WA ter-prefill; bila halaman merujuk unit (?unit= dari VDP Fase 5),
// nama unit ikut disebut dalam pesan.
const waHref = (whatsapp: string) => {
  const unit = typeof route.query.unit === "string" ? route.query.unit : null;
  const pesan = unit
    ? `Halo, saya tertarik dengan unit ${unit}. Bisa minta info lengkapnya?`
    : "Halo, saya mau tanya-tanya soal unit yang tersedia.";
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(pesan)}`;
};
</script>

<template>
  <div class="section-inner py-8 md:py-12">
    <h2 v-if="data.heading" class="mb-6 text-2xl font-bold md:text-3xl">
      {{ data.heading }}
    </h2>
    <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="(sales, i) in data.sales" :key="i">
        <a
          :href="waHref(sales.whatsapp)"
          rel="noopener"
          target="_blank"
          class="flex items-center justify-between gap-3 rounded-theme border border-text/10 p-4 font-medium"
        >
          {{ sales.name }}
          <span class="text-sm font-semibold text-primary">Chat WA →</span>
        </a>
      </li>
    </ul>
  </div>
</template>
