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
</script>

<template>
  <div class="tenant-shell">
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
/* Styling minimal Fase 1; theming CSS-variable menyusul di Fase 2. */
.tenant-shell {
  max-width: 60rem;
  margin: 0 auto;
  padding: 0 1rem;
  font-family: system-ui, sans-serif;
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
