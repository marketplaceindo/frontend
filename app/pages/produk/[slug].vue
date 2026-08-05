<script setup lang="ts">
import type { Product, RenderTenantResponse } from "@marketplaceindo/shared";

definePageMeta({ layout: false });

/** PDP (/produk/[slug]) — galeri, harga, deskripsi, CTA pesan via WhatsApp. */
const route = useRoute();
const { tautan } = useTenantLink();
const routing = useTenantRouting();
const requestFetch = useRequestFetch();

const isPreview = computed(() => route.query.preview === "1");
const slug = computed(() => String(route.params.slug ?? ""));

const { data, error } = await useAsyncData(
  () => `produk-detail:${slug.value}:${isPreview.value ? "p" : "l"}`,
  async () => {
    if (routing.value.mode !== "tenant") {
      throw createError({ statusCode: 404, message: "Halaman tidak ditemukan" });
    }
    const query = isPreview.value ? { preview: "1" } : {};
    const [site, product] = await Promise.all([
      requestFetch<RenderTenantResponse>("/api/_render/site", { query }),
      requestFetch<Product>(`/api/_render/products/${slug.value}`, { query }),
    ]);
    return { site, product };
  },
);
if (error.value) rethrowRenderError(error.value);

const site = computed(() => data.value?.site);
const product = computed(() => data.value?.product);
const tenantSite = useTenantSite();
watchEffect(() => {
  tenantSite.value = data.value?.site ?? null;
});

const waHref = computed(() => {
  const p = product.value;
  if (!p || !site.value) return null;
  return `https://wa.me/${site.value.contact.whatsapp}?text=${encodeURIComponent(
    `Halo, saya mau pesan ${p.name}. Apakah masih tersedia?`,
  )}`;
});

const noindex = computed(() => isPreview.value || site.value?.tenant.status !== "active");
const { canonical } = useTenantSeo({
  title: () => product.value?.name ?? "",
  description: () => product.value?.description?.slice(0, 160),
  noindex: () => noindex.value,
});

// JSON-LD Product (PDP katalog).
useHead({
  script: () =>
    product.value && !noindex.value
      ? [
          {
            type: "application/ld+json",
            innerHTML: serializeJsonLd(productJsonLd(product.value, canonical.value)),
          },
        ]
      : [],
});
</script>

<template>
  <NuxtLayout v-if="data && site && product" name="tenant" :site="site" :preview="isPreview">
    <article class="section-inner py-8 md:py-12">
      <nav class="text-sm opacity-70" aria-label="Breadcrumb">
        <NuxtLink :to="tautan('/produk')">Semua Produk</NuxtLink>
        <span aria-hidden="true"> / </span>
        <span>{{ product.name }}</span>
      </nav>

      <div class="mt-4 grid gap-8 md:grid-cols-2">
        <!-- Galeri: resolusi mediaId → URL menyusul di backend media (Fase 7). -->
        <div>
          <div class="aspect-square overflow-hidden rounded-theme bg-text/5" />
          <ul v-if="product.mediaIds?.length" class="mt-3 grid grid-cols-4 gap-2">
            <li
              v-for="mediaId in product.mediaIds"
              :key="mediaId"
              class="aspect-square rounded-theme bg-text/5"
            />
          </ul>
        </div>

        <div>
          <p v-if="product.category" class="text-sm opacity-60">{{ product.category }}</p>
          <h1 class="text-2xl font-bold md:text-3xl">{{ product.name }}</h1>
          <p class="mt-2 text-3xl font-bold text-primary" data-testid="harga-produk">
            {{ formatRupiah(product.price) }}
          </p>
          <p v-if="product.inStock === false" class="mt-2 text-sm font-medium text-secondary">
            Stok sedang habis
          </p>

          <p v-if="product.description" class="mt-6 text-sm leading-relaxed whitespace-pre-line opacity-90">
            {{ product.description }}
          </p>

          <div class="mt-6">
            <a
              v-if="waHref && product.inStock !== false"
              :href="waHref"
              rel="noopener"
              target="_blank"
              :class="ctaClass('primary')"
            >
              Pesan via WhatsApp
            </a>
          </div>
        </div>
      </div>
    </article>
  </NuxtLayout>
</template>
