<script setup lang="ts">
/**
 * Bar perbandingan melayang (addendum §Fase 5B.2) — muncul begitu user memilih
 * varian untuk dibandingkan, dari kartu model, tabel varian, maupun VDP.
 *
 * Di mobile ia duduk DI ATAS tombol WhatsApp mengambang, tidak menumpuknya —
 * dua-duanya elemen konversi dan saling menutupi akan merugikan keduanya.
 */
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "compare_tray" }>["data"];
defineProps<{ data: Data }>();

const { tautan } = useTenantLink();

const compare = useCompare();

// Duduk di atas whatsapp_float di mobile (bottom-20), lebih rapat di desktop.
const posisiKelas = "bottom-20 md:bottom-4";

/*
 * Sengaja TIDAK memakai <Teleport to="body">. Nuxt menyerialkan isi teleport
 * SSR ke dalam <div id="teleports">, sedangkan di klien `to="body"` menunjuk
 * document.body — anchor-nya tidak ketemu dan hidrasi meleset ("Hydration
 * completed but contains mismatches"). Elemen `position: fixed` tidak perlu
 * jadi anak langsung <body>, jadi dirender di tempat saja.
 */
</script>

<template>
  <div
    v-if="compare.items.value.length"
    class="fixed inset-x-0 z-40 px-3"
    :class="posisiKelas"
    role="region"
    :aria-label="data.label ?? 'Perbandingan varian'"
  >
    <div class="mi-tray mx-auto flex max-w-3xl items-center gap-3 p-2.5">
      <ul class="flex min-w-0 flex-1 gap-2 overflow-x-auto">
        <li
          v-for="item in compare.items.value"
          :key="`${item.modelSlug}:${item.variantSlug}`"
          class="mi-chip shrink-0 gap-1.5 px-2.5 py-1 text-xs"
        >
          <span class="max-w-[9rem] truncate">{{ item.modelSlug }} {{ item.variantSlug }}</span>
          <button
            type="button"
            class="opacity-60 transition-opacity hover:opacity-100"
            :aria-label="`Hapus ${item.modelSlug} ${item.variantSlug} dari perbandingan`"
            @click="compare.remove(item)"
          >
            ✕
          </button>
        </li>
      </ul>

      <NuxtLink :to="tautan(compare.href.value)" :class="ctaClass('primary')" class="shrink-0">
        Bandingkan ({{ compare.items.value.length }})
      </NuxtLink>
    </div>
  </div>
</template>
