<script setup lang="ts">
import type {
  Block,
  RenderPageResponse,
  RenderTenantResponse,
} from "@marketplaceindo/shared";
/**
 * Dashboard dimuat lazy (Fase 8): editor + wizard + billing adalah bundel besar
 * yang TIDAK relevan bagi pengunjung situs tenant. Impor dinamis membuatnya
 * jadi chunk terpisah sehingga halaman publik tidak ikut mengunduhnya.
 */
const DashboardApp = defineAsyncComponent(() => import("./dashboard/DashboardApp.vue"));

// Dipakai pages/index.vue dan pages/[...slug].vue (keduanya layout: false);
// satu komponen supaya logika render tenant/dashboard tidak terduplikasi.
const route = useRoute();
const routing = useTenantRouting();

// Saat SSR, $fetch internal tidak membawa header Host asli — pakai
// useRequestFetch supaya /api/_render/* menerima Host tenant yang benar.
const requestFetch = useRequestFetch();

const isPreview = computed(() => route.query.preview === "1");
const slugParts = computed(() => {
  const raw = route.params.slug;
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
});
const pageSlug = computed(() => slugParts.value[0] ?? "home");

const { data, error } = await useAsyncData<
  { site: RenderTenantResponse; page: RenderPageResponse } | null
>(
  () =>
    `render:${routing.value.mode}:${pageSlug.value}:${isPreview.value ? "preview" : "live"}`,
  async () => {
    if (routing.value.mode !== "tenant") return null;
    // Path bertingkat (a/b) belum ada di Fase 1 (detail collection = Fase 5).
    if (slugParts.value.length > 1) {
      throw createError({ statusCode: 404, message: "Halaman tidak ditemukan" });
    }
    const query = {
      slug: pageSlug.value,
      ...(isPreview.value ? { preview: "1" } : {}),
    };
    const [site, page] = await Promise.all([
      requestFetch<RenderTenantResponse>("/api/_render/site", { query }),
      requestFetch<RenderPageResponse>("/api/_render/page", { query }),
    ]);
    return { site, page };
  },
);

if (error.value) rethrowRenderError(error.value);

const site = computed(() => data.value?.site);

// Bagikan data situs ke block (mis. VehicleCard butuh WA kontak tenant).
const tenantSite = useTenantSite();
watchEffect(() => {
  tenantSite.value = data.value?.site ?? null;
});

const seo = computed(() => data.value?.page.page.seoJson);
const pageTitle = computed(() =>
  routing.value.mode === "tenant"
    ? (seo.value?.title ?? data.value?.page.page.title ?? "")
    : "Dashboard — MarketIndonesia",
);

// draft/suspended/preview SELALU noindex; hormati juga seoJson.noindex per halaman.
const noindex = computed(
  () =>
    routing.value.mode === "tenant" &&
    (isPreview.value || site.value?.tenant.status !== "active" || seo.value?.noindex === true),
);

// Mode dashboard: SEO minimal (bukan situs tenant); tenant: SEO penuh + JSON-LD.
const { origin } = useTenantSeo({
  title: () => pageTitle.value,
  description: () => seo.value?.description,
  ogImage: () => seo.value?.ogImage?.url,
  noindex: () => noindex.value || routing.value.mode !== "tenant",
});

// JSON-LD: LocalBusiness (Restaurant utk kuliner + hasMenu) + FAQPage bila ada.
const allBlocks = computed<Block[]>(() =>
  (data.value?.page.sections ?? []).flatMap((s) => s.blocks),
);
const menuBlock = computed(() =>
  allBlocks.value.find((b): b is Extract<Block, { type: "menu" }> => b.type === "menu"),
);
const faqBlock = computed(() =>
  allBlocks.value.find((b): b is Extract<Block, { type: "faq" }> => b.type === "faq"),
);

const jsonLd = computed(() => {
  const s = site.value;
  if (routing.value.mode !== "tenant" || !s || noindex.value) return [];
  const business = {
    name: businessName(seo.value?.title, s.tenant.subdomain),
    url: origin,
    whatsapp: s.contact.whatsapp,
    address: s.contact.address || undefined,
    image: toAbsoluteUrl(origin, seo.value?.ogImage?.url),
  };
  const list = [
    s.template.slug === "kuliner"
      ? restaurantJsonLd(business, menuBlock.value?.data)
      : localBusinessJsonLd(business),
  ];
  if (faqBlock.value) list.push(faqPageJsonLd(faqBlock.value.data.items));
  return list;
});

useHead({
  script: () =>
    jsonLd.value.length
      ? [{ type: "application/ld+json", innerHTML: serializeJsonLd(jsonLd.value) }]
      : [],
});
</script>

<template>
  <NuxtLayout
    v-if="routing.mode === 'tenant' && data && site"
    name="tenant"
    :site="site"
    :preview="isPreview"
  >
    <SectionRenderer :sections="data.page.sections" />
  </NuxtLayout>

  <NuxtLayout v-else name="dashboard">
    <DashboardApp />
  </NuxtLayout>
</template>
