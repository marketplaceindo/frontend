<script setup lang="ts">
import type {
  RenderPageResponse,
  RenderTenantResponse,
} from "@marketplaceindo/shared";
import type { TenantRouting } from "../../shared/types/tenant-routing";

// Dipakai pages/index.vue dan pages/[...slug].vue (keduanya layout: false);
// satu komponen supaya logika render tenant/dashboard tidak terduplikasi.
const route = useRoute();

// Mode routing dihitung server-side dari Host (server/plugins/tenant.ts) dan
// dibekukan di state — host tidak berubah selama navigasi client-side.
const routing = useState<TenantRouting>("tenant-routing", () => {
  if (import.meta.server) {
    const fromHost = useRequestEvent()?.context.tenant as TenantRouting | undefined;
    return fromHost ?? { mode: "dashboard" };
  }
  return { mode: "dashboard" };
});

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

if (error.value) {
  // error dari $fetch membungkus response route internal di .data — ambil
  // payload kontrak ({ error: { code, message } }) dari lapisan terdalam.
  const nested = error.value.data as
    | { data?: { error?: { code?: string; message?: string } } }
    | undefined;
  const apiError = nested?.data?.error;
  throw createError({
    statusCode: error.value.statusCode ?? 500,
    message: apiError?.message ?? error.value.message,
    data: apiError ? { error: apiError } : error.value.data,
    fatal: true,
  });
}

const site = computed(() => data.value?.site);

// SEO: title/description dari seoJson; draft/suspended/preview SELALU noindex.
const noindex = computed(
  () =>
    routing.value.mode === "tenant" &&
    (isPreview.value || site.value?.tenant.status !== "active"),
);
useSeoMeta({
  title: () =>
    routing.value.mode === "tenant"
      ? (data.value?.page.page.seoJson?.title ?? data.value?.page.page.title ?? "")
      : "Dashboard — MarketIndonesia",
  description: () => data.value?.page.page.seoJson?.description,
  robots: () => (noindex.value ? "noindex, nofollow" : undefined),
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
    <h1>Dashboard MarketIndonesia</h1>
    <p>
      Onboarding, editor konten, dan billing dibangun di Fase 7. Situs tenant
      diakses lewat subdomain, mis. <code>demo.lvh.me:3000</code>.
    </p>
  </NuxtLayout>
</template>
