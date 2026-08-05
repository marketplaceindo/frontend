<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "footer" }>["data"];
defineProps<{ data: Data }>();

const { tautan } = useTenantLink();

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
};
</script>

<template>
  <footer class="border-t border-text/10">
    <div class="section-inner py-8 text-sm">
      <p v-if="data.text" class="opacity-90">{{ data.text }}</p>
      <ul v-if="data.links?.length" class="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        <li v-for="link in data.links" :key="link.href">
          <a :href="tautan(link.href)">{{ link.label }}</a>
        </li>
      </ul>
      <ul v-if="data.socials?.length" class="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        <li v-for="social in data.socials" :key="social.platform">
          <a :href="social.url" rel="noopener" target="_blank">
            {{ SOCIAL_LABELS[social.platform] ?? social.platform }}
          </a>
        </li>
      </ul>
      <!-- Badge viral loop plan dasar: backlink dofollow ke domain utama. -->
      <p class="mt-6 text-xs opacity-70">
        Dibuat dengan
        <a href="https://marketindonesia.co.id" target="_blank" rel="noopener" class="font-semibold">
          MarketIndonesia
        </a>
      </p>
    </div>
  </footer>
</template>
