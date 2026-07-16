<script setup lang="ts">
import type { RenderTenantResponse } from "@marketplaceindo/shared";

const props = defineProps<{
  site: RenderTenantResponse;
  preview?: boolean;
}>();

const navHref = (slug: string) => (slug === "home" ? "/" : `/${slug}`);
const showPreviewBanner = computed(
  () => props.preview || props.site.tenant.status !== "active",
);

// Level 2 cascade: tenant.themeJson → CSS vars inline di root wrapper
// (ter-render di HTML SSR → tanpa FOUC) + font loading dinamis.
const { themeStyle } = useTenantTheme(() => props.site.theme);
</script>

<template>
  <div class="tenant-shell" :style="themeStyle">
    <p v-if="showPreviewBanner" class="preview-banner" data-testid="preview-banner">
      Mode preview — halaman ini tidak diindeks mesin pencari dan bisa berbeda
      dari versi live.
    </p>

    <header>
      <nav aria-label="Navigasi utama">
        <NuxtLink
          v-for="item in site.nav"
          :key="item.slug"
          :to="navHref(item.slug)"
          class="nav-link"
        >
          {{ item.title }}
        </NuxtLink>
      </nav>
    </header>

    <main>
      <slot />
    </main>

    <footer>
      <p>{{ site.contact.address }}</p>
      <a :href="`https://wa.me/${site.contact.whatsapp}`" rel="noopener">
        Hubungi via WhatsApp
      </a>
    </footer>
  </div>
</template>

<style scoped>
/* Warna/font shell datang dari token .tenant-shell (main.css). */
main,
header,
footer {
  max-width: 60rem;
  margin: 0 auto;
  padding: 0 1rem;
}
.preview-banner {
  background: #fef3c7;
  border: 1px solid #f59e0b;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
}
.nav-link {
  margin-right: 1rem;
}
footer {
  margin-top: 2rem;
  padding: 1rem 0;
  border-top: 1px solid #e5e7eb;
  font-size: 0.875rem;
}
</style>
