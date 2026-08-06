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
    <div class="mi-section-head">
      <h2 v-if="data.heading" class="text-2xl font-bold text-balance md:text-3xl">
        {{ data.heading }}
      </h2>
      <p class="mt-1.5 text-sm" style="color: var(--color-muted)">
        Harga OTR {{ model.city?.name ?? "kota utama" }}
      </p>
    </div>

    <ul class="flex flex-col" style="gap: var(--mi-gap, 1rem)">
      <li
        v-for="variant in model.variants"
        :key="variant.slug"
        class="mi-card mi-variant-row p-4 md:p-5"
      >
        <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-base font-semibold">{{ variant.name }}</h3>
              <span class="mi-badge" :class="`mi-stok-${variant.stockStatus}`">
                {{ STOK_LABEL[variant.stockStatus] }}
              </span>
            </div>

            <ul v-if="variant.highlights.length" class="mt-2.5 flex flex-wrap gap-1.5">
              <li
                v-for="h in variant.highlights.slice(0, jumlahHighlight)"
                :key="h"
                class="mi-spec-pill"
              >
                {{ h }}
              </li>
            </ul>
          </div>

          <!-- Harga di kanan pada layar lebar: kolom angka yang sejajar jauh
               lebih mudah dibandingkan sekilas daripada harga yang berpindah
               posisi mengikuti panjang nama varian. -->
          <p class="shrink-0 text-lg font-bold text-primary md:text-right">
            {{ hargaVarian(variant.priceOtr) ? formatRupiah(hargaVarian(variant.priceOtr)!.price) : "—" }}
          </p>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <NuxtLink
            :to="tautan(`/mobil/${model.model.slug}/${variant.slug}`)"
            class="mi-chip"
          >
            Lihat detail →
          </NuxtLink>
          <button
            v-if="data.tampilkanTombolBandingkan"
            type="button"
            class="mi-chip"
            :class="
              compare.has({ modelSlug: model.model.slug, variantSlug: variant.slug })
                ? 'mi-chip-active'
                : ''
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
