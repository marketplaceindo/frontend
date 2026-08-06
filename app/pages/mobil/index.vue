<script setup lang="ts">
/**
 * Listing model mobil baru (`/mobil`, addendum §Fase 5). Filter lewat query
 * param SSR supaya tiap kombinasi punya URL unik yang crawlable & shareable.
 */
import type { RenderModelsResponse, RenderTenantResponse } from "@marketplaceindo/shared";
import ModelCard from "../../components/blocks/ModelCard.vue";
import BlockCompareTray from "../../components/blocks/BlockCompareTray.vue";

definePageMeta({ layout: false });

const route = useRoute();
const routing = useTenantRouting();
const requestFetch = useRequestFetch();
const kota = useKotaAktif();

const isPreview = computed(() => route.query.preview === "1");

const BODY_TYPES = [
  ["mpv", "MPV"],
  ["suv", "SUV"],
  ["sedan", "Sedan"],
  ["hatchback", "Hatchback"],
  ["pickup", "Pikap"],
  ["lcgc", "LCGC"],
] as const;

const query = computed(() => ({
  ...(route.query.body ? { body: String(route.query.body) } : {}),
  ...(route.query.brand ? { brand: String(route.query.brand) } : {}),
  ...(route.query.hargaMax ? { hargaMax: String(route.query.hargaMax) } : {}),
  ...(route.query.sort ? { sort: String(route.query.sort) } : {}),
  ...(kota.value ? { city: kota.value } : {}),
  ...(isPreview.value ? { preview: "1" } : {}),
}));

const { data, error } = await useAsyncData(
  () => `mobil-listing:${JSON.stringify(query.value)}`,
  async () => {
    if (routing.value.mode !== "tenant") {
      throw createError({ statusCode: 404, message: "Halaman tidak ditemukan" });
    }
    const [site, list] = await Promise.all([
      requestFetch<RenderTenantResponse>("/api/_render/site", {
        query: isPreview.value ? { preview: "1" } : {},
      }),
      requestFetch<RenderModelsResponse>("/api/_render/models", { query: query.value }),
    ]);
    return { site, list };
  },
);
if (error.value) rethrowRenderError(error.value);

const tenantSite = useTenantSite();
watchEffect(() => {
  tenantSite.value = data.value?.site ?? null;
});

useTenantSeo({
  title: () => "Mobil Baru",
  description: () =>
    `Daftar mobil baru beserta harga OTR ${data.value?.list.city?.name ?? ""}.`,
  noindex: () => isPreview.value || data.value?.site.tenant.status !== "active",
});
</script>

<template>
  <NuxtLayout v-if="data" name="tenant" :site="data.site" :preview="isPreview">
    <div class="section-shell">
      <div class="section-inner py-8 md:py-12">
        <div class="mi-section-head">
          <p class="mi-eyebrow">Katalog</p>
          <h1 class="mt-1.5 text-3xl font-bold md:text-4xl">Mobil Baru</h1>
          <p class="mt-2 text-sm" style="color: var(--color-muted)">
            Harga OTR {{ data.list.city?.name ?? "kota utama" }}
            <template v-if="data.list.items.length">
              · {{ data.list.items.length }} model
            </template>
          </p>
        </div>

        <!-- Form GET native: setiap filter menghasilkan URL sendiri -->
        <form method="get" class="mb-7 flex flex-wrap items-center gap-2">
          <select name="body" :value="route.query.body ?? ''" class="mi-field w-auto" aria-label="Tipe bodi">
            <option value="">Semua tipe</option>
            <option v-for="[value, label] in BODY_TYPES" :key="value" :value="value">
              {{ label }}
            </option>
          </select>
          <input
            name="hargaMax"
            type="number"
            step="10000000"
            placeholder="Harga maksimal"
            :value="route.query.hargaMax ?? ''"
            class="mi-field w-auto"
            aria-label="Harga maksimal"
          />
          <select name="sort" :value="route.query.sort ?? ''" class="mi-field w-auto" aria-label="Urutkan">
            <option value="">Urutan default</option>
            <option value="harga_asc">Harga termurah</option>
            <option value="harga_desc">Harga tertinggi</option>
          </select>
          <button type="submit" :class="ctaClass('primary')">Terapkan</button>
        </form>

        <ul v-if="data.list.items.length" class="mi-grid">
          <ModelCard v-for="model in data.list.items" :key="model.slug" :model="model" />
        </ul>
        <p v-else class="mi-empty">Tidak ada model yang cocok dengan filter ini.</p>
      </div>
    </div>

    <BlockCompareTray :data="{ label: 'Bandingkan', posisi: 'bottom' }" />
  </NuxtLayout>
</template>
