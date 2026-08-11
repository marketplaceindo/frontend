<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";
import BlockImage from "./BlockImage.vue";
import { useEmblaCarousel } from "../../composables/useEmblaCarousel";

type Data = Extract<Block, { type: "hero" }>["data"];
const props = defineProps<{ data: Data }>();

const { tautan } = useTenantLink();

const alignClass = computed(() => {
  switch (props.data.align) {
    case "left": return "text-left items-start";
    case "right": return "text-right items-end";
    default: return "text-center items-center";
  }
});

// --- Slider logic ---
const hasSlides = computed(() => (props.data.slides?.length ?? 0) > 0);
const emblaRef = ref<HTMLElement | null>(null);

const { selectedIndex, scrollSnaps, scrollTo, scrollPrev, scrollNext } =
  useEmblaCarousel(emblaRef, {
    loop: true,
    autoPlayMs: props.data.autoPlayMs ?? 5000,
  });
</script>

<template>
  <!-- Sapuan warna lembut dari token tenant: memberi kedalaman pada bagian
       paling atas halaman tanpa menambah satu pun warna di luar tema. -->
  <div class="mi-wash relative">
    <div class="section-inner flex flex-col gap-8 py-12 md:py-20" :class="alignClass">
      <div class="max-w-2xl">
        <h1 class="text-[2rem] leading-[1.1] font-bold text-balance md:text-5xl lg:text-6xl">
          {{ data.heading }}
        </h1>
        <p
          v-if="data.subheading"
          class="mt-5 text-base leading-relaxed text-pretty md:text-lg"
          style="color: var(--color-muted)"
        >
          {{ data.subheading }}
        </p>
        <div
          v-if="data.ctas?.length"
          class="mt-8 flex flex-wrap gap-3"
          :class="data.align === 'right' ? 'justify-end' : data.align === 'left' ? 'justify-start' : 'justify-center'"
        >
          <a
            v-for="cta in data.ctas"
            :key="cta.href"
            :href="tautan(cta.href)"
            :class="[ctaClass(cta.variant), 'px-6 py-3 text-base']"
          >
            {{ cta.label }}
          </a>
        </div>
      </div>

      <!-- ===== SLIDER (baru) ===== -->
      <div v-if="hasSlides" class="mi-hero-media w-full overflow-hidden relative">
        <div ref="emblaRef" class="overflow-hidden rounded-theme">
          <div class="flex">
            <div
              v-for="(slide, i) in data.slides"
              :key="i"
              class="relative min-w-0 flex-[0_0_100%]"
            >
              <component
                :is="slide.href ? 'a' : 'div'"
                :href="slide.href ? tautan(slide.href) : undefined"
                class="block aspect-video w-full"
              >
                <BlockImage :image="slide.image" :eager="i === 0" />
                <!-- Badge diskon / label -->
                <span
                  v-if="slide.label"
                  class="absolute top-4 left-4 rounded-full px-4 py-1.5 text-sm font-bold shadow-lg"
                  :class="{
                    'bg-primary text-on-primary': slide.labelVariant === 'primary' || !slide.labelVariant,
                    'bg-accent text-white': slide.labelVariant === 'accent',
                    'bg-white text-text': slide.labelVariant === 'white',
                  }"
                >
                  {{ slide.label }}
                </span>
              </component>
            </div>
          </div>
        </div>

        <!-- Tombol prev/next -->
        <button
          v-if="scrollSnaps.length > 1"
          class="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm hover:bg-black/60"
          aria-label="Slide sebelumnya"
          @click="scrollPrev()"
        >
          ‹
        </button>
        <button
          v-if="scrollSnaps.length > 1"
          class="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm hover:bg-black/60"
          aria-label="Slide berikutnya"
          @click="scrollNext()"
        >
          ›
        </button>

        <!-- Dot indicators -->
        <div v-if="scrollSnaps.length > 1" class="mt-3 flex justify-center gap-2">
          <button
            v-for="(_, i) in scrollSnaps"
            :key="i"
            class="h-2.5 w-2.5 rounded-full transition-colors"
            :class="i === selectedIndex ? 'bg-primary' : 'bg-text/20'"
            :aria-label="`Slide ${i + 1}`"
            @click="scrollTo(i)"
          />
        </div>
      </div>

      <!-- ===== GAMBAR TUNGGAL (perilaku lama, backward compat) ===== -->
      <div v-else-if="data.image" class="mi-hero-media aspect-video w-full overflow-hidden">
        <BlockImage :image="data.image" eager />
      </div>
    </div>
  </div>
</template>
