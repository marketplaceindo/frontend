<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "cta_band" }>["data"];
defineProps<{ data: Data }>();

const { tautan } = useTenantLink();
</script>

<template>
  <div class="section-inner py-8 md:py-12">
    <div class="mi-cta-band relative overflow-hidden p-8 text-center md:p-14">
      <h2 class="relative text-2xl font-bold text-balance md:text-4xl">{{ data.heading }}</h2>
      <p v-if="data.subheading" class="relative mx-auto mt-4 max-w-xl opacity-90">
        {{ data.subheading }}
      </p>
      <!-- Band sudah ber-bg primary → tombol dibalik: latar = warna teks band
           itu sendiri, jadi kontrasnya ikut benar meski tenant memilih warna
           utama terang (dulu selalu putih + teks primary, yang hilang total
           kalau warna utamanya pucat). -->
      <a :href="tautan(data.cta.href)" class="mi-cta mi-cta-band-btn relative mt-8">
        {{ data.cta.label }}
      </a>
    </div>
  </div>
</template>
