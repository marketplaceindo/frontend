<script setup lang="ts">
import type { RenderTenantResponse } from "@marketplaceindo/shared";
import { withChromeFallback, type SiteChrome } from "../utils/site-chrome";
import BlockNavbar from "../components/blocks/BlockNavbar.vue";
import BlockFooter from "../components/blocks/BlockFooter.vue";
import BlockWhatsappFloat from "../components/blocks/BlockWhatsappFloat.vue";

const props = defineProps<{
  site: RenderTenantResponse;
  preview?: boolean;
  /**
   * Chrome (nav/kaki/float) yang diangkat dari section halaman. Halaman katalog
   * tidak punya section, jadi mereka tidak mengirim apa-apa dan layout memakai
   * cadangan dari `site.nav` — lihat utils/site-chrome.ts.
   */
  chrome?: SiteChrome;
}>();

const showPreviewBanner = computed(
  () => props.preview || props.site.tenant.status !== "active",
);

const chromeFinal = computed(() => withChromeFallback(props.chrome, props.site));

// Level 2 cascade: tenant.themeJson → CSS vars inline di root wrapper
// (ter-render di HTML SSR → tanpa FOUC) + kelas lapisan bentuk (preset,
// gaya kartu, kerapatan) + font loading dinamis.
const { themeStyle, themeClass } = useTenantTheme(() => props.site.theme);
</script>

<template>
  <div class="tenant-shell" :class="themeClass" :style="themeStyle">
    <p v-if="showPreviewBanner" class="preview-banner" data-testid="preview-banner">
      Mode preview — halaman ini tidak diindeks mesin pencari dan bisa berbeda
      dari versi live.
    </p>

    <BlockNavbar
      v-if="chromeFinal.navbar"
      :data="chromeFinal.navbar.data"
      :brand-name="site.brandName"
      :logo-url="site.logoUrl"
      :whatsapp="site.contact.whatsapp"
    />

    <main>
      <slot />
    </main>

    <BlockFooter
      v-if="chromeFinal.footer"
      :data="chromeFinal.footer.data"
      :brand-name="site.brandName"
      :address="site.contact.address"
      :whatsapp="site.contact.whatsapp"
    />

    <BlockWhatsappFloat
      v-for="(float, i) in chromeFinal.floats"
      :key="i"
      :data="float.data"
    />
  </div>
</template>

<style scoped>
/* Warna/font shell dari token .tenant-shell (main.css). main full-bleed —
   tiap section mengatur containernya sendiri via .section-inner.
   Nav & kaki situs TIDAK lagi di-render di sini sebagai markup telanjang:
   keduanya block yang bisa diedit tenant, diangkat dari section halaman
   supaya tidak tampil dua kali (lihat utils/site-chrome.ts). */
.preview-banner {
  background: #fef3c7;
  color: #78350f;
  border-bottom: 1px solid #f59e0b;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  text-align: center;
}
</style>
