<script setup lang="ts">
import type { RenderTenantResponse, Vehicle } from "@marketplaceindo/shared";
import BlockSimulasiKredit from "../../components/blocks/BlockSimulasiKredit.vue";
import BlockTestDrive from "../../components/blocks/BlockTestDrive.vue";

definePageMeta({ layout: false });

/**
 * VDP (/mobil/[slug]) — template halaman tetap: galeri, spesifikasi, harga,
 * CTA (hubungi sales / test drive / simulasi kredit ter-prefill harga unit).
 */
const route = useRoute();
const routing = useTenantRouting();
const requestFetch = useRequestFetch();

const isPreview = computed(() => route.query.preview === "1");
const slug = computed(() => String(route.params.slug ?? ""));

const { data, error } = await useAsyncData(
  () => `mobil-detail:${slug.value}:${isPreview.value ? "p" : "l"}`,
  async () => {
    if (routing.value.mode !== "tenant") {
      throw createError({ statusCode: 404, message: "Halaman tidak ditemukan" });
    }
    const query = isPreview.value ? { preview: "1" } : {};
    const [site, vehicle] = await Promise.all([
      requestFetch<RenderTenantResponse>("/api/_render/site", { query }),
      requestFetch<Vehicle>(`/api/_render/vehicles/${slug.value}`, { query }),
    ]);
    return { site, vehicle };
  },
);
if (error.value) rethrowRenderError(error.value);

const site = computed(() => data.value?.site);
const vehicle = computed(() => data.value?.vehicle);
const tenantSite = useTenantSite();
watchEffect(() => {
  tenantSite.value = data.value?.site ?? null;
});

const TRANSMISSION_LABELS: Record<string, string> = {
  manual: "Manual",
  automatic: "Otomatis (Matic)",
  cvt: "CVT",
};
const FUEL_LABELS: Record<string, string> = {
  bensin: "Bensin",
  diesel: "Diesel",
  listrik: "Listrik",
  hybrid: "Hybrid",
};

const specs = computed(() => {
  const v = vehicle.value;
  if (!v) return [];
  return [
    ["Merk", v.brand],
    ["Model", v.model],
    ["Tahun", String(v.year)],
    ["Transmisi", v.transmission ? TRANSMISSION_LABELS[v.transmission] : undefined],
    ["Bahan bakar", v.fuelType ? FUEL_LABELS[v.fuelType] : undefined],
    ["Kilometer", v.mileageKm !== undefined ? `${v.mileageKm.toLocaleString("id-ID")} km` : undefined],
    ["Warna", v.color],
  ].filter((row): row is [string, string] => row[1] !== undefined);
});

const waHref = computed(() => {
  const v = vehicle.value;
  if (!v || !site.value) return null;
  return `https://wa.me/${site.value.contact.whatsapp}?text=${encodeURIComponent(
    `Halo, saya tertarik dengan ${v.name} (${v.year}) yang saya lihat di situs. Apakah masih tersedia?`,
  )}`;
});

// Konfigurasi kalkulator default VDP; harga unit ter-prefill dari data unit.
const kreditConfig = {
  bungaDefault: 6.5,
  tenorOptions: [12, 24, 36, 48, 60],
  metodeDefault: "flat" as const,
  dpMin: 20,
};

const noindex = computed(() => isPreview.value || site.value?.tenant.status !== "active");
useSeoMeta({
  title: () => (vehicle.value ? `${vehicle.value.name} ${vehicle.value.year}` : ""),
  description: () => vehicle.value?.description?.slice(0, 160),
  robots: () => (noindex.value ? "noindex, nofollow" : undefined),
});
</script>

<template>
  <NuxtLayout v-if="data && site && vehicle" name="tenant" :site="site" :preview="isPreview">
    <article class="section-inner py-8 md:py-12">
      <nav class="text-sm opacity-70" aria-label="Breadcrumb">
        <NuxtLink to="/mobil">Semua Mobil</NuxtLink>
        <span aria-hidden="true"> / </span>
        <span>{{ vehicle.name }}</span>
      </nav>

      <div class="mt-4 grid gap-8 md:grid-cols-2">
        <!-- Galeri: resolusi mediaId → URL menyusul di backend media (Fase 7). -->
        <div>
          <div class="relative aspect-video overflow-hidden rounded-theme bg-text/5">
            <span
              v-if="vehicle.sold"
              class="absolute top-3 left-3 rounded-theme bg-secondary px-3 py-1 text-sm font-semibold text-white"
            >
              Terjual
            </span>
          </div>
          <ul v-if="vehicle.mediaIds?.length" class="mt-3 grid grid-cols-4 gap-2">
            <li
              v-for="mediaId in vehicle.mediaIds"
              :key="mediaId"
              class="aspect-video rounded-theme bg-text/5"
            />
          </ul>
        </div>

        <div>
          <h1 class="text-2xl font-bold md:text-3xl">{{ vehicle.name }}</h1>
          <p class="mt-2 text-3xl font-bold text-primary" data-testid="harga-unit">
            {{ formatRupiah(vehicle.price) }}
          </p>

          <table class="mt-6 w-full text-sm">
            <tbody>
              <tr v-for="[label, value] in specs" :key="label" class="border-b border-text/10">
                <th scope="row" class="py-2 pr-4 text-left font-medium opacity-70">{{ label }}</th>
                <td class="py-2">{{ value }}</td>
              </tr>
            </tbody>
          </table>

          <div class="mt-6 flex flex-wrap gap-3">
            <a v-if="waHref && !vehicle.sold" :href="waHref" rel="noopener" target="_blank" :class="ctaClass('primary')">
              Hubungi Sales
            </a>
            <a v-if="!vehicle.sold" href="#test-drive" :class="ctaClass('secondary')">Jadwalkan Test Drive</a>
            <a href="#simulasi-kredit" :class="ctaClass('outline')">Simulasi Kredit</a>
          </div>
        </div>
      </div>

      <section v-if="vehicle.description" class="mt-10 max-w-3xl">
        <h2 class="text-xl font-bold">Deskripsi</h2>
        <p class="mt-3 text-sm leading-relaxed whitespace-pre-line opacity-90">
          {{ vehicle.description }}
        </p>
      </section>
    </article>

    <section id="simulasi-kredit" class="section-shell border-t border-text/10">
      <!-- Harga unit otomatis mengisi kalkulator (DoD Fase 5). -->
      <BlockSimulasiKredit :data="kreditConfig" :harga-awal="vehicle.price" />
    </section>

    <section v-if="!vehicle.sold" id="test-drive" class="section-shell border-t border-text/10">
      <BlockTestDrive
        :data="{
          heading: 'Jadwalkan Test Drive',
          description: `Coba langsung ${vehicle.name} — isi form ini dan tim kami akan mengatur jadwalnya.`,
          vehicleSlug: vehicle.slug,
        }"
      />
    </section>
  </NuxtLayout>
</template>
