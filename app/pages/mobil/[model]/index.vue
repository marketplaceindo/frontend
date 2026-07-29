<script setup lang="ts">
/**
 * Halaman model (`/mobil/[model]`, addendum §Fase 5.2–5.3).
 *
 * Sengaja TIDAK redirect ke varian: halaman model punya nilai SEO sendiri —
 * volume pencarian "harga xpander" jauh lebih besar daripada "harga xpander
 * ultimate". Hero & harga memakai varian default (`isFeatured`, fallback
 * `trimRank` tertinggi).
 */
import type { RenderModelResponse, RenderTenantResponse } from "@marketplaceindo/shared";
import { hargaOtrDiKota, varianDefault } from "@marketplaceindo/shared";
import BlockVariantTable from "../../../components/blocks/BlockVariantTable.vue";
import BlockCompareTray from "../../../components/blocks/BlockCompareTray.vue";
import BlockImage from "../../../components/blocks/BlockImage.vue";

definePageMeta({ layout: false });

const route = useRoute();
const routing = useTenantRouting();
const requestFetch = useRequestFetch();
const kota = useKotaAktif();

const isPreview = computed(() => route.query.preview === "1");
const modelSlug = computed(() => String(route.params.model ?? ""));

const { data, error } = await useAsyncData(
  () => `model:${modelSlug.value}:${kota.value}:${isPreview.value ? "p" : "l"}`,
  async () => {
    if (routing.value.mode !== "tenant") {
      throw createError({ statusCode: 404, message: "Halaman tidak ditemukan" });
    }
    const q = { ...(kota.value ? { city: kota.value } : {}), ...(isPreview.value ? { preview: "1" } : {}) };
    const [site, model] = await Promise.all([
      requestFetch<RenderTenantResponse>("/api/_render/site", {
        query: isPreview.value ? { preview: "1" } : {},
      }),
      requestFetch<RenderModelResponse>(`/api/_render/models/${modelSlug.value}`, { query: q }),
    ]);
    return { site, model };
  },
);
if (error.value) rethrowRenderError(error.value);

const tenantSite = useTenantSite();
watchEffect(() => {
  tenantSite.value = data.value?.site ?? null;
});

const utama = computed(() => {
  const variants = data.value?.model.variants ?? [];
  return varianDefault(variants) ?? variants[0];
});
const hargaUtama = computed(() => {
  const v = utama.value;
  return v ? hargaOtrDiKota(v, data.value?.model.city?.code) : undefined;
});

const { origin } = useTenantSeo({
  title: () => {
    const m = data.value?.model.model;
    return m ? `${m.brand} ${m.name} ${m.modelYear}` : "";
  },
  description: () => data.value?.model.model.summary,
  noindex: () => isPreview.value || data.value?.site.tenant.status !== "active",
});

/**
 * `ProductGroup` + `hasVariant` adalah mekanisme resmi Google untuk
 * mengelompokkan varian (addendum §Fase 6). Tiap varian tetap punya markup
 * `Product` lengkap di halamannya sendiri.
 */
const jsonLd = computed(() => {
  const d = data.value;
  if (!d || isPreview.value || d.site.tenant.status !== "active") return [];
  const m = d.model.model;
  return [
    {
      "@context": "https://schema.org",
      "@type": "ProductGroup",
      name: `${m.brand} ${m.name}`,
      description: m.summary,
      brand: { "@type": "Brand", name: m.brand },
      productGroupID: m.slug,
      variesBy: ["https://schema.org/model"],
      url: `${origin}/mobil/${m.slug}`,
      hasVariant: d.model.variants.map((v) => {
        const harga = hargaOtrDiKota(v, d.model.city?.code);
        return {
          "@type": "Product",
          name: `${m.brand} ${m.name} ${v.name}`,
          sku: v.slug,
          inProductGroupWithID: m.slug,
          url: `${origin}/mobil/${m.slug}/${v.slug}`,
          ...(harga
            ? {
                offers: {
                  "@type": "Offer",
                  price: harga.price,
                  priceCurrency: "IDR",
                  availability:
                    v.stockStatus === "habis"
                      ? "https://schema.org/OutOfStock"
                      : "https://schema.org/InStock",
                },
              }
            : {}),
        };
      }),
    },
  ];
});

useHead({
  script: () =>
    jsonLd.value.length
      ? [{ type: "application/ld+json", innerHTML: serializeJsonLd(jsonLd.value) }]
      : [],
});
</script>

<template>
  <NuxtLayout v-if="data" name="tenant" :site="data.site" :preview="isPreview">
    <article class="section-shell">
      <div class="section-inner py-8 md:py-12">
        <nav class="text-xs opacity-70" aria-label="Breadcrumb">
          <NuxtLink to="/">Beranda</NuxtLink> ›
          <NuxtLink to="/mobil">Mobil</NuxtLink> ›
          <span>{{ data.model.model.name }}</span>
        </nav>

        <div class="mt-4 overflow-hidden rounded-theme border border-text/10">
          <div class="aspect-video bg-text/5">
            <BlockImage :image="data.model.model.images[0]" eager />
          </div>
        </div>

        <p class="mt-6 text-sm opacity-70">
          {{ data.model.model.brand }} · {{ data.model.model.modelYear }}
        </p>
        <h1 class="text-2xl font-bold md:text-3xl">{{ data.model.model.name }}</h1>
        <p class="mt-2 opacity-90">{{ data.model.model.summary }}</p>

        <p v-if="hargaUtama" class="mt-4 text-xl font-bold text-primary">
          <span class="text-sm font-normal opacity-70">Mulai dari</span>
          {{ formatRupiah(hargaUtama.price) }}
          <span class="text-sm font-normal opacity-70">OTR {{ hargaUtama.cityName }}</span>
        </p>

        <p v-if="data.model.model.description" class="mt-4 text-sm leading-relaxed opacity-90">
          {{ data.model.model.description }}
        </p>
      </div>
    </article>

    <section class="section-shell border-t border-text/10">
      <BlockVariantTable
        :data="{
          heading: 'Pilih Varian',
          jumlahHighlight: 3,
          tampilkanTombolBandingkan: true,
        }"
        :model-slug="modelSlug"
      />
    </section>

    <BlockCompareTray :data="{ label: 'Bandingkan', posisi: 'bottom' }" />
  </NuxtLayout>
</template>
