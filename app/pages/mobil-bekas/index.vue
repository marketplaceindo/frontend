<script setup lang="ts">
import type {
  RenderTenantResponse,
  Transmission,
  VehicleUnit,
} from "@marketplaceindo/shared";
import { TRANSMISSIONS } from "@marketplaceindo/shared";
import UnitCard from "../../components/blocks/UnitCard.vue";

definePageMeta({ layout: false });

/**
 * Listing kendaraan (/mobil) — filter via query params supaya URL shareable
 * & crawlable; hasil filter di-render SSR (tetap ter-index).
 */
const route = useRoute();
const { tautan } = useTenantLink();
const routing = useTenantRouting();
const requestFetch = useRequestFetch();

const isPreview = computed(() => route.query.preview === "1");

const FILTER_KEYS = ["q", "brand", "priceMin", "priceMax", "year", "transmission", "cursor"] as const;
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
  () => `mobil-list:${JSON.stringify(apiQuery.value)}`,
  async () => {
    if (routing.value.mode !== "tenant") {
      throw createError({ statusCode: 404, message: "Halaman tidak ditemukan" });
    }
    const [site, list] = await Promise.all([
      requestFetch<RenderTenantResponse>("/api/_render/site", {
        query: isPreview.value ? { preview: "1" } : {},
      }),
      requestFetch<{ items: VehicleUnit[]; nextCursor: string | null }>("/api/_render/units", {
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

const TRANSMISSION_LABELS: Record<Transmission, string> = {
  manual: "Manual",
  automatic: "Matic",
  cvt: "CVT",
};

// Link pagination membawa filter aktif → tiap halaman punya URL unik.
const nextPageTo = computed(() => {
  const nextCursor = data.value?.list.nextCursor;
  if (!nextCursor) return null;
  return { path: "/mobil", query: { ...route.query, cursor: nextCursor } };
});

const noindex = computed(() => isPreview.value || site.value?.tenant.status !== "active");
useTenantSeo({
  title: () => `Semua Mobil — ${site.value?.tenant.subdomain ?? ""}`,
  description: () => "Daftar mobil bekas yang tersedia — filter merk, harga, tahun, dan transmisi.",
  noindex: () => noindex.value,
});
</script>

<template>
  <NuxtLayout v-if="data && site" name="tenant" :site="site" :preview="isPreview">
    <div class="section-inner py-8 md:py-12">
      <div class="mi-section-head">
        <p class="mi-eyebrow">Katalog</p>
        <h1 class="mt-1.5 text-3xl font-bold md:text-4xl">Mobil Bekas</h1>
      </div>

      <!-- Form GET native: submit menghasilkan URL filter yang shareable.
           `action` menunjuk halaman ini sendiri — sebelumnya "/mobil", yang
           melempar filter unit bekas (tahun, transmisi, harga) ke listing
           mobil BARU yang tidak mengenal satu pun param itu. -->
      <form method="get" class="mb-7 grid grid-cols-2 gap-3 md:grid-cols-6" action="/mobil-bekas">
        <input
          type="text"
          name="brand"
          placeholder="Merk (mis. Toyota)"
          :value="route.query.brand ?? ''"
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
        <input
          type="number"
          name="year"
          placeholder="Tahun"
          :value="route.query.year ?? ''"
          class="mi-field"
        />
        <select
          name="transmission"
          :value="route.query.transmission ?? ''"
          class="mi-field"
        >
          <option value="">Semua transmisi</option>
          <option v-for="t in TRANSMISSIONS" :key="t" :value="t">
            {{ TRANSMISSION_LABELS[t] }}
          </option>
        </select>
        <button type="submit" :class="ctaClass('primary')">Terapkan</button>
      </form>

      <p class="mb-4 flex flex-wrap items-center gap-3 text-sm" data-testid="jumlah-hasil">
        <span style="color: var(--color-muted)">{{ data.list.items.length }} unit ditampilkan</span>
        <!-- Menunjuk halaman ini, bukan "/mobil" — mereset filter tidak boleh
             memindahkan user ke listing mobil baru. -->
        <NuxtLink
          v-if="Object.keys(route.query).length"
          :to="tautan('/mobil-bekas')"
          class="mi-chip"
        >
          Hapus filter
        </NuxtLink>
      </p>

      <ul v-if="data.list.items.length" class="mi-grid">
        <UnitCard v-for="vehicle in data.list.items" :key="vehicle.id" :unit="vehicle" />
      </ul>
      <p v-else class="mt-6 mi-empty">
        Tidak ada unit yang cocok dengan filter ini.
      </p>

      <p v-if="nextPageTo" class="mt-6">
        <NuxtLink :to="nextPageTo" :class="ctaClass('outline')">Muat unit berikutnya »</NuxtLink>
      </p>
    </div>
  </NuxtLayout>
</template>
