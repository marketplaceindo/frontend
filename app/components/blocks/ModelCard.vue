<script setup lang="ts">
/**
 * Kartu model mobil baru — dipakai `model_grid` dan `featured_vehicles`.
 * Harga selalu "mulai dari" (varian termurah di kota aktif, D-03), bukan angka
 * tunggal tanpa konteks.
 */
import type { RenderModelCard } from "@marketplaceindo/shared";
import BlockImage from "./BlockImage.vue";
import PriceEstimatedNote from "./PriceEstimatedNote.vue";

const props = defineProps<{
  model: RenderModelCard;
  /** Varian spesifik (dari featured_vehicles) — kalau ada, tautkan ke VDP-nya. */
  variantSlug?: string;
  /** Sembunyikan tombol bandingkan (mis. di grid pendek). */
  tanpaBandingkan?: boolean;
}>();

const compare = useCompare();

const href = computed(() =>
  props.variantSlug
    ? `/mobil/${props.model.slug}/${props.variantSlug}`
    : `/mobil/${props.model.slug}`,
);

const refVarian = computed(() => ({
  modelSlug: props.model.slug,
  variantSlug: props.variantSlug ?? props.model.defaultVariantSlug,
}));

const dipilih = computed(() => compare.has(refVarian.value));
</script>

<template>
  <li class="overflow-hidden rounded-theme border border-text/10" :data-model="model.slug">
    <NuxtLink :to="href" class="block">
      <div class="aspect-video bg-text/5">
        <BlockImage :image="model.image" />
      </div>
      <div class="p-4">
        <p class="text-xs opacity-70">{{ model.brand }} · {{ model.modelYear }}</p>
        <h3 class="mt-0.5 font-semibold">{{ model.name }}</h3>
        <p class="mt-1 line-clamp-2 text-sm opacity-80">{{ model.summary }}</p>
        <p v-if="model.priceFrom !== null" class="mt-2 font-bold text-primary">
          <span class="text-xs font-normal opacity-70">Mulai dari</span>
          {{ formatRupiah(model.priceFrom) }}
        </p>
        <PriceEstimatedNote
          v-if="model.priceFrom !== null && model.priceEstimated"
          ringkas
          :from-city="model.priceEstimatedFromCity"
        />
        <p v-else class="mt-2 text-sm opacity-70">Harga belum tersedia di kota ini</p>
        <p class="mt-1 text-xs opacity-70">{{ model.variantCount }} varian</p>
      </div>
    </NuxtLink>

    <div v-if="!tanpaBandingkan" class="border-t border-text/10 px-4 py-3">
      <button
        type="button"
        class="text-sm font-semibold"
        :class="dipilih ? 'text-primary' : 'opacity-80'"
        :aria-pressed="dipilih"
        @click="compare.toggle(refVarian)"
      >
        {{ dipilih ? "✓ Dibandingkan" : "+ Bandingkan" }}
      </button>
    </div>
  </li>
</template>
