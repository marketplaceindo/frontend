<script setup lang="ts">
import type { Product, RenderTenantResponse } from "@marketplaceindo/shared";
import ProductCard from "../../components/blocks/ProductCard.vue";

definePageMeta({ layout: false });

/** Listing produk (/produk) — filter §7: q, category, priceMin, priceMax. */
const route = useRoute();
const { tautan } = useTenantLink();
const routing = useTenantRouting();
const requestFetch = useRequestFetch();

const isPreview = computed(() => route.query.preview === "1");

const FILTER_KEYS = ["q", "category", "priceMin", "priceMax", "cursor"] as const;
const apiQuery = computed(() => {
  const q: Record<string, string> = { limit: "12" };
  for (const key of FILTER_KEYS) {
    const value = route.query[key];
    if (typeof value === "string" && value !== "") q[key] = value;
  }
  if (isPreview.value) q.preview = "1";
  return q;
});

const { data, error } = await useAsyncData(
  () => `produk-list:${JSON.stringify(apiQuery.value)}`,
  async () => {
    if (routing.value.mode !== "tenant") {
      throw createError({ statusCode: 404, message: "Halaman tidak ditemukan" });
    }
    const [site, list] = await Promise.all([
      requestFetch<RenderTenantResponse>("/api/_render/site", {
        query: isPreview.value ? { preview: "1" } : {},
      }),
      requestFetch<{ items: Product[]; nextCursor: string | null }>("/api/_render/products", {
        query: apiQuery.value,
      }),
    ]);
    return { site, list };
  },
);
if (error.value) rethrowRenderError(error.value);

const site = computed(() => data.value?.site);
const tenantSite = useTenantSite();
watchEffect(() => {
  tenantSite.value = data.value?.site ?? null;
});

const nextPageTo = computed(() => {
  const nextCursor = data.value?.list.nextCursor;
  if (!nextCursor) return null;
  return { path: "/produk", query: { ...route.query, cursor: nextCursor } };
});

const noindex = computed(() => isPreview.value || site.value?.tenant.status !== "active");
useTenantSeo({
  title: () => `Semua Produk — ${site.value?.tenant.subdomain ?? ""}`,
  description: () => "Katalog produk yang tersedia — filter kategori dan rentang harga.",
  noindex: () => noindex.value,
});
</script>

<template>
  <NuxtLayout v-if="data && site" name="tenant" :site="site" :preview="isPreview">
    <div class="section-inner py-8 md:py-12">
      <div class="mi-section-head">
        <p class="mi-eyebrow">Katalog</p>
        <h1 class="mt-1.5 text-3xl font-bold md:text-4xl">Semua Produk</h1>
      </div>

      <form method="get" class="mb-7 grid grid-cols-2 gap-3 md:grid-cols-5" action="/produk">
        <input
          type="text"
          name="q"
          placeholder="Cari produk…"
          :value="route.query.q ?? ''"
          class="mi-field"
        />
        <input
          type="text"
          name="category"
          placeholder="Kategori"
          :value="route.query.category ?? ''"
          class="mi-field"
        />
        <input
          type="number"
          name="priceMin"
          placeholder="Harga min"
          :value="route.query.priceMin ?? ''"
          class="mi-field"
        />
        <input
          type="number"
          name="priceMax"
          placeholder="Harga maks"
          :value="route.query.priceMax ?? ''"
          class="mi-field"
        />
        <button type="submit" :class="ctaClass('primary')">Terapkan</button>
      </form>

      <p class="mb-4 flex flex-wrap items-center gap-3 text-sm" data-testid="jumlah-hasil">
        <span style="color: var(--color-muted)">{{ data.list.items.length }} produk ditampilkan</span>
        <NuxtLink v-if="Object.keys(route.query).length" :to="tautan('/produk')" class="mi-chip">
          Hapus filter
        </NuxtLink>
      </p>

      <ul v-if="data.list.items.length" class="mi-grid-sm">
        <ProductCard v-for="product in data.list.items" :key="product.id" :product="product" />
      </ul>
      <p v-else class="mt-6 mi-empty">Tidak ada produk yang cocok dengan filter ini.</p>

      <p v-if="nextPageTo" class="mt-6">
        <NuxtLink :to="nextPageTo" :class="ctaClass('outline')">Muat produk berikutnya »</NuxtLink>
      </p>
    </div>
  </NuxtLayout>
</template>
