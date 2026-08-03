<script setup lang="ts">
/**
 * VDP varian (`/mobil/[model]/[varian]`, addendum §4.1) — halaman konversi
 * utama. Baris CTA sticky di mobile adalah elemen konversi tunggal paling
 * penting di seluruh situs, karena itu selalu terlihat saat scroll.
 */
import type { RenderTenantResponse, RenderVariantResponse } from "@marketplaceindo/shared";
import { getSpecDef, specsByGroup } from "@marketplaceindo/shared";
import BlockSimulasiKredit from "../../../components/blocks/BlockSimulasiKredit.vue";
import BlockTestDrive from "../../../components/blocks/BlockTestDrive.vue";
import BlockCompareTray from "../../../components/blocks/BlockCompareTray.vue";
import BlockImage from "../../../components/blocks/BlockImage.vue";

definePageMeta({ layout: false });

const route = useRoute();
const routing = useTenantRouting();
const requestFetch = useRequestFetch();
const kota = useKotaAktif();
const compare = useCompare();

const isPreview = computed(() => route.query.preview === "1");
const modelSlug = computed(() => String(route.params.model ?? ""));
const varianSlug = computed(() => String(route.params.varian ?? ""));

const { data, error } = await useAsyncData(
  () => `varian:${modelSlug.value}/${varianSlug.value}:${kota.value}:${isPreview.value ? "p" : "l"}`,
  async () => {
    if (routing.value.mode !== "tenant") {
      throw createError({ statusCode: 404, message: "Halaman tidak ditemukan" });
    }
    const q = {
      ...(kota.value ? { city: kota.value } : {}),
      ...(isPreview.value ? { preview: "1" } : {}),
    };
    const [site, detail] = await Promise.all([
      requestFetch<RenderTenantResponse>("/api/_render/site", {
        query: isPreview.value ? { preview: "1" } : {},
      }),
      requestFetch<RenderVariantResponse>(
        `/api/_render/models/${modelSlug.value}/${varianSlug.value}`,
        { query: q },
      ),
    ]);
    return { site, detail };
  },
);
if (error.value) rethrowRenderError(error.value);

const tenantSite = useTenantSite();
watchEffect(() => {
  tenantSite.value = data.value?.site ?? null;
});

const namaLengkap = computed(() => {
  const d = data.value?.detail;
  return d ? `${d.model.brand} ${d.model.name} ${d.variant.name}` : "";
});

const warnaAktif = ref(0);

/** Spesifikasi dikelompokkan per group registry — hanya yang terisi. */
const grupSpec = computed(() => {
  const specs = data.value?.detail.variant.specs ?? {};
  return specsByGroup()
    .map((g) => ({
      group: g.group,
      rows: g.specs
        .filter((def) => specs[def.key] !== undefined)
        .map((def) => ({ def, value: specs[def.key]! })),
    }))
    .filter((g) => g.rows.length);
});

function tampilkanNilai(key: string, value: string | number | boolean): string {
  const def = getSpecDef(key);
  if (typeof value === "boolean") return value ? "Ada" : "Tidak";
  if (typeof value === "number") {
    return def?.unit ? `${value.toLocaleString("id-ID")} ${def.unit}` : value.toLocaleString("id-ID");
  }
  return value;
}

const waHref = computed(() => {
  const wa = data.value?.site.contact.whatsapp;
  if (!wa) return "";
  const pesan = `Halo, saya tertarik dengan ${namaLengkap.value}. Bisa dibantu?`;
  return `https://wa.me/${wa}?text=${encodeURIComponent(pesan)}`;
});

const kreditConfig = {
  heading: "Simulasi Kredit",
  metodeDefault: "flat" as const,
  tampilkanKeduaMetode: true,
  bungaPerTahunDefault: 6.5,
  tenorOptionsBulan: [12, 24, 36, 48, 60],
  dpMinPersen: 20,
  dpDefaultPersen: 25,
  asuransi: {
    aktif: true,
    tipeDefault: "all_risk" as const,
    ratePersenPerTahun: { tlo: 1.2, all_risk: 2.5 },
  },
  biayaTambahan: { adminRp: 1_500_000, provisiPersen: 1, fidusiaRp: 500_000 },
  leasingPartners: [],
  disclaimer:
    "Angka di atas adalah simulasi, belum termasuk biaya yang bisa berbeda per leasing. Persetujuan kredit sepenuhnya ada di pihak perusahaan pembiayaan.",
};

const { origin } = useTenantSeo({
  title: () => namaLengkap.value,
  description: () => data.value?.detail.model.summary,
  noindex: () => isPreview.value || data.value?.site.tenant.status !== "active",
});

const jsonLd = computed(() => {
  const d = data.value;
  if (!d || isPreview.value || d.site.tenant.status !== "active") return [];
  return [
    {
      "@context": "https://schema.org",
      "@type": ["Product", "Car"],
      name: namaLengkap.value,
      sku: d.detail.variant.slug,
      brand: { "@type": "Brand", name: d.detail.model.brand },
      inProductGroupWithID: d.detail.model.slug,
      vehicleConfiguration: d.detail.variant.name,
      url: `${origin}/mobil/${d.detail.model.slug}/${d.detail.variant.slug}`,
      ...(d.detail.price
        ? {
            offers: {
              "@type": "Offer",
              price: d.detail.price.price,
              priceCurrency: "IDR",
              availability:
                d.detail.variant.stockStatus === "habis"
                  ? "https://schema.org/OutOfStock"
                  : "https://schema.org/InStock",
            },
          }
        : {}),
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
    <article class="section-shell pb-24 md:pb-8">
      <div class="section-inner py-6 md:py-10">
        <nav class="text-xs opacity-70" aria-label="Breadcrumb">
          <NuxtLink to="/">Beranda</NuxtLink> ›
          <NuxtLink to="/mobil">Mobil</NuxtLink> ›
          <NuxtLink :to="`/mobil/${data.detail.model.slug}`">{{ data.detail.model.name }}</NuxtLink>
          › <span>{{ data.detail.variant.name }}</span>
        </nav>

        <div class="mt-4 overflow-hidden rounded-theme border border-text/10">
          <div class="aspect-video bg-text/5">
            <BlockImage :image="data.detail.model.images[0]" eager />
          </div>
        </div>

        <h1 class="mt-6 text-2xl font-bold md:text-3xl">{{ namaLengkap }}</h1>
        <p v-if="data.detail.price" class="mt-2 text-xl font-bold text-primary">
          {{ formatRupiah(data.detail.price.price) }}
          <span class="text-sm font-normal opacity-70">OTR {{ data.detail.price.cityName }}</span>
        </p>
        <PriceEstimatedNote
          v-if="data.detail.price && data.detail.variant.priceEstimated"
          :city-name="data.detail.price.cityName"
          :from-city="data.detail.variant.priceEstimatedFromCity"
        />
        <p v-else class="mt-2 text-sm opacity-70">Harga belum tersedia untuk kota ini.</p>
        <p class="mt-1 text-sm opacity-70">
          Status stok:
          {{
            data.detail.variant.stockStatus === "ready"
              ? "Ready"
              : data.detail.variant.stockStatus === "indent"
                ? "Indent"
                : "Habis"
          }}
        </p>

        <ul
          v-if="data.detail.variant.highlights.length"
          class="mt-4 space-y-1 text-sm opacity-90"
        >
          <li v-for="h in data.detail.variant.highlights" :key="h">• {{ h }}</li>
        </ul>

        <!-- Pilihan warna: ganti swatch + selisih harga -->
        <section v-if="data.detail.variant.colors.length" class="mt-6">
          <h2 class="text-sm font-semibold">Warna</h2>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="(c, i) in data.detail.variant.colors"
              :key="c.name"
              type="button"
              class="flex items-center gap-2 rounded-theme border px-3 py-2 text-sm"
              :class="i === warnaAktif ? 'border-primary' : 'border-text/20'"
              :aria-pressed="i === warnaAktif"
              @click="warnaAktif = i"
            >
              <span class="size-4 rounded-full border border-text/20" :style="{ backgroundColor: c.hex }" />
              {{ c.name }}
              <span v-if="c.additionalPrice" class="opacity-70">
                +{{ formatRupiah(c.additionalPrice) }}
              </span>
            </button>
          </div>
        </section>

        <!-- Spesifikasi per grup registry (kunci kanonik → bisa dibandingkan) -->
        <section class="mt-8">
          <h2 class="text-xl font-bold">Spesifikasi</h2>
          <details v-for="g in grupSpec" :key="g.group" class="mt-3 rounded-theme border border-text/10" open>
            <summary class="cursor-pointer px-4 py-3 font-semibold capitalize">{{ g.group }}</summary>
            <dl class="divide-y divide-text/10 border-t border-text/10">
              <div v-for="row in g.rows" :key="row.def.key" class="flex justify-between gap-4 px-4 py-2 text-sm">
                <dt class="opacity-80">{{ row.def.label }}</dt>
                <dd class="text-right font-medium">{{ tampilkanNilai(row.def.key, row.value) }}</dd>
              </div>
            </dl>
          </details>
        </section>

        <!-- Bandingkan dengan varian lain: satu tap → /bandingkan terisi -->
        <section v-if="data.detail.siblings.length" class="mt-8">
          <h2 class="text-xl font-bold">Bandingkan dengan varian lain</h2>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="s in data.detail.siblings"
              :key="s.slug"
              type="button"
              class="rounded-theme border border-text/20 px-3 py-2 text-sm"
              @click="
                compare.toggle({ modelSlug: data.detail.model.slug, variantSlug: data.detail.variant.slug });
                compare.toggle({ modelSlug: data.detail.model.slug, variantSlug: s.slug });
              "
            >
              vs {{ s.name }}
            </button>
          </div>
        </section>
      </div>
    </article>

    <section id="simulasi-kredit" class="section-shell border-t border-text/10">
      <BlockSimulasiKredit
        :data="kreditConfig"
        :harga-awal="data.detail.price?.price"
        :label-unit="namaLengkap"
      />
    </section>

    <section id="test-drive" class="section-shell border-t border-text/10">
      <BlockTestDrive
        :data="{
          heading: 'Jadwalkan Test Drive',
          description: `Coba langsung ${namaLengkap} sebelum memutuskan.`,
          aktif: true,
          butuhTanggal: true,
          slotWaktu: ['09:00-12:00', '12:00-15:00', '15:00-18:00'],
          lokasiOptions: [],
          minLeadTimeHari: 1,
          pesanSukses: 'Terima kasih! Sales kami akan menghubungi via WhatsApp.',
          fallbackWhatsApp: true,
        }"
        ref-type="variant"
        :ref-slug="data.detail.variant.slug"
        :ref-label="namaLengkap"
      />
    </section>

    <!-- Baris CTA sticky: elemen konversi paling penting di halaman ini -->
    <div
      class="fixed inset-x-0 bottom-0 z-30 border-t border-text/10 bg-bg p-3 md:hidden"
      role="group"
      aria-label="Aksi cepat"
    >
      <div class="flex gap-2">
        <a :href="waHref" target="_blank" rel="noopener" :class="ctaClass('primary')" class="flex-1 text-center">
          Chat Sales
        </a>
        <a href="#test-drive" :class="ctaClass('outline')" class="flex-1 text-center">Test Drive</a>
        <a href="#simulasi-kredit" :class="ctaClass('outline')" class="flex-1 text-center">Kredit</a>
      </div>
    </div>

    <BlockCompareTray :data="{ label: 'Bandingkan', posisi: 'bottom' }" />
  </NuxtLayout>
</template>
