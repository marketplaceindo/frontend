<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";
import BlockImage from "./BlockImage.vue";

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
    <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="(sales, i) in data.sales" :key="i">
        <a
          :href="waHref(sales.whatsapp)"
          rel="noopener"
          target="_blank"
          class="flex items-center gap-4 rounded-theme border border-text/10 p-4 transition-shadow hover:shadow-md"
        >
          <!-- Foto sales (bulat) -->
          <div
            class="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-text/5"
          >
            <BlockImage
              v-if="sales.photo"
              :image="sales.photo"
              class="h-full w-full object-cover"
            />
            <!-- Placeholder inisial jika tidak ada foto -->
            <div
              v-else
              class="flex h-full w-full items-center justify-center text-lg font-bold text-text/40"
            >
              {{ sales.name.charAt(0).toUpperCase() }}
            </div>
          </div>

          <!-- Info sales -->
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium">{{ sales.name }}</p>
            <p v-if="sales.role" class="truncate text-xs" style="color: var(--color-muted)">
              {{ sales.role }}
            </p>
          </div>

          <!-- Tombol WA -->
          <span class="flex-shrink-0 text-sm font-semibold text-primary">
            Chat WA →
          </span>
        </a>
      </li>
    </ul>
  </div>
</template>
