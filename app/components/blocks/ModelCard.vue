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

const { tautan } = useTenantLink();

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
  <li class="mi-card mi-card-link flex flex-col" :data-model="model.slug">
    <NuxtLink :to="tautan(href)" class="flex flex-1 flex-col no-underline">
      <div class="mi-card-media relative aspect-video">
        <BlockImage :image="model.image" />
        <!-- Jumlah varian di atas foto: informasi yang menentukan klik, jadi
             ditaruh di tempat mata jatuh pertama, bukan di baris terakhir. -->
        <span v-if="model.variantCount" class="mi-badge mi-badge-overlay absolute top-2.5 left-2.5">
          {{ model.variantCount }} varian
        </span>
      </div>

      <div class="flex flex-1 flex-col p-4">
        <p class="mi-eyebrow">{{ model.brand }} · {{ model.modelYear }}</p>
        <h3 class="mt-1.5 text-base font-semibold">{{ model.name }}</h3>
        <p
          v-if="model.summary"
          class="mt-1.5 line-clamp-2 text-sm leading-relaxed"
          style="color: var(--color-muted)"
        >
          {{ model.summary }}
        </p>

        <!-- mt-auto: harga selalu menempel di dasar kartu, jadi seluruh baris
             harga sejajar antar kartu walau ringkasannya beda panjang. -->
        <div class="mt-auto pt-4">
          <template v-if="model.priceFrom !== null">
            <p class="mi-eyebrow">Mulai dari</p>
            <p class="mt-0.5 text-lg font-bold text-primary">
              {{ formatRupiah(model.priceFrom) }}
            </p>
            <PriceEstimatedNote v-if="model.priceEstimated" ringkas :from-city="model.priceEstimatedFromCity" />
          </template>
          <p v-else class="text-sm" style="color: var(--color-muted)">
            Harga belum tersedia di kota ini
          </p>
        </div>
      </div>
    </NuxtLink>

    <div v-if="!tanpaBandingkan" class="px-4 pb-4">
      <button
        type="button"
        class="mi-chip w-full justify-center"
        :class="dipilih ? 'mi-chip-active' : ''"
        :aria-pressed="dipilih"
        @click="compare.toggle(refVarian)"
      >
        {{ dipilih ? "✓ Dibandingkan" : "+ Bandingkan" }}
      </button>
    </div>
  </li>
</template>
