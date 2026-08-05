<script setup lang="ts">
/**
 * Tabel ringkas seluruh varian satu model (addendum §Fase 4): nama, harga di
 * kota aktif, beberapa highlight pembeda, dan CTA. Dipakai di halaman model.
 */
import type { Block, RenderModelResponse } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "variant_table" }>["data"];
const props = defineProps<{
  data: Data;

  /** Halaman model mengoper slug-nya; block bisa juga dikonfigurasi manual. */
  modelSlug?: string;
}>();

const { tautan } = useTenantLink();

const requestFetch = useRequestFetch();
const route = useRoute();
const kota = useKotaAktif();
const compare = useCompare();

const slug = computed(() => props.data.modelSlug ?? props.modelSlug ?? "");

const { data: result } = await useAsyncData(
  () => `variant-table:${slug.value}:${kota.value}`,
  async () => {
    if (!slug.value) return null;
    return requestFetch<RenderModelResponse>(`/api/_render/models/${slug.value}`, {
      query: {
        ...(kota.value ? { city: kota.value } : {}),
        ...(route.query.preview === "1" ? { preview: "1" } : {}),
      },
    });
  },
);

const jumlahHighlight = computed(() => props.data.jumlahHighlight ?? 3);
/** Non-null di template karena seluruh blok dibungkus `v-if="model"`. */
const model = computed(() => result.value);

function hargaVarian(priceOtr: RenderModelResponse["variants"][number]["priceOtr"]) {
  const kotaAktif = model.value?.city?.code;
  return priceOtr.find((p) => p.cityCode === kotaAktif) ?? priceOtr[0];
}

const STOK_LABEL = { ready: "Ready", indent: "Indent", habis: "Habis" } as const;
</script>

<template>
  <div v-if="model" class="section-inner py-8 md:py-12">
    <h2 v-if="data.heading" class="mb-2 text-2xl font-bold md:text-3xl">{{ data.heading }}</h2>
    <p class="mb-6 text-sm opacity-70">Harga OTR {{ model.city?.name ?? "kota utama" }}</p>

    <ul class="space-y-3">
      <li
        v-for="variant in model.variants"
        :key="variant.slug"
        class="rounded-theme border border-text/10 p-4"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="font-semibold">{{ variant.name }}</h3>
          <span class="text-xs opacity-70">{{ STOK_LABEL[variant.stockStatus] }}</span>
        </div>

        <p class="mt-1 font-bold text-primary">
          {{ hargaVarian(variant.priceOtr) ? formatRupiah(hargaVarian(variant.priceOtr)!.price) : "—" }}
        </p>

        <ul v-if="variant.highlights.length" class="mt-2 space-y-0.5 text-sm opacity-80">
          <li v-for="h in variant.highlights.slice(0, jumlahHighlight)" :key="h">• {{ h }}</li>
        </ul>

        <div class="mt-3 flex flex-wrap gap-3">
          <NuxtLink
            :to="tautan(`/mobil/${model.model.slug}/${variant.slug}`)"
            class="text-sm font-semibold text-primary"
          >
            Lihat detail →
          </NuxtLink>
          <button
            v-if="data.tampilkanTombolBandingkan"
            type="button"
            class="text-sm font-semibold"
            :class="
              compare.has({ modelSlug: model.model.slug, variantSlug: variant.slug })
                ? 'text-primary'
                : 'opacity-80'
            "
            :aria-pressed="compare.has({ modelSlug: model.model.slug, variantSlug: variant.slug })"
            @click="compare.toggle({ modelSlug: model.model.slug, variantSlug: variant.slug })"
          >
            {{
              compare.has({ modelSlug: model.model.slug, variantSlug: variant.slug })
                ? "✓ Dibandingkan"
                : "+ Bandingkan"
            }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
