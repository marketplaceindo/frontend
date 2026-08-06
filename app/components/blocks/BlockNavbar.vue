<script setup lang="ts">
/**
 * Navigasi utama situs tenant.
 *
 * Di-render sekali oleh `layouts/tenant.vue` (lihat utils/site-chrome.ts),
 * bukan di dalam aliran section — sebelumnya navbar block dan `<header>` layout
 * tampil bersamaan sebagai dua baris tautan bertumpuk.
 *
 * Catatan hidrasi: panel mobil **tidak** memakai `<Teleport to="body">`.
 * Nuxt menyerialkan isi teleport ke `<div id="teleports">` sehingga anchor di
 * klien tidak ketemu dan hidrasi pecah (lihat REPORT-FRONTEND §4.8) — panel
 * karena itu hidup di dalam <header> dan diposisikan absolut.
 */
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "navbar" }>["data"];

const props = defineProps<{
  data: Data;
  /** Wordmark saat tenant belum punya logo. */
  brandName?: string;
  /** Sudah berupa URL (resolusi mediaId adalah tugas backend, kontrak §6). */
  logoUrl?: string;
  /** Sumber tombol CTA di kanan; tanpa ini tombolnya tidak muncul. */
  whatsapp?: string;
  waMessage?: string;
}>();

const { tautan } = useTenantLink();
const route = useRoute();

const terbuka = ref(false);
/**
 * Bayangan baru muncul setelah halaman digulir — supaya navbar menyatu dengan
 * hero saat di puncak, lalu terangkat begitu konten lewat di bawahnya.
 * Nilai awal `false` sama di server dan klien, jadi tidak ada mismatch hidrasi.
 */
const tergulir = ref(false);

function onScroll() {
  tergulir.value = window.scrollY > 8;
}

onMounted(() => {
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
});
onBeforeUnmount(() => window.removeEventListener("scroll", onScroll));

// Pindah halaman = tutup panel; tanpa ini panel tetap terbuka menutupi konten.
watch(() => route.fullPath, () => (terbuka.value = false));

/** Bandingkan path saja — `tautan()` menempelkan `?preview=1` ke href. */
function aktif(href: string): boolean {
  const path = href.split("?")[0] ?? "";
  if (!path.startsWith("/")) return false;
  return path === "/" ? route.path === "/" : route.path.startsWith(path);
}

const waHref = computed(() => {
  if (!props.whatsapp) return null;
  const base = `https://wa.me/${props.whatsapp}`;
  return props.waMessage ? `${base}?text=${encodeURIComponent(props.waMessage)}` : base;
});
</script>

<template>
  <header
    class="mi-nav border-b transition-shadow"
    :class="[
      data.sticky ? 'sticky top-0 z-40' : '',
      tergulir ? 'shadow-card' : '',
    ]"
  >
    <div class="section-inner flex h-16 items-center gap-3">
      <!-- Identitas: logo bila ada, kalau tidak wordmark teks. -->
      <NuxtLink
        v-if="logoUrl || brandName"
        :to="tautan('/')"
        class="flex shrink-0 items-center gap-2.5 no-underline"
        :aria-label="brandName ?? 'Beranda'"
      >
        <img
          v-if="logoUrl"
          :src="logoUrl"
          :alt="brandName ?? ''"
          class="h-9 w-auto max-w-[10rem] object-contain"
          decoding="async"
        />
        <span
          v-else
          class="font-heading truncate text-base font-bold tracking-tight"
          style="color: var(--color-text)"
        >
          {{ brandName }}
        </span>
      </NuxtLink>

      <!-- Tautan desktop. Garis aktif memakai warna utama tenant, bukan abu-abu. -->
      <nav class="ml-auto hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
        <NuxtLink
          v-for="link in data.links"
          :key="link.href"
          :to="tautan(link.href)"
          class="mi-nav-link"
          :class="aktif(link.href) ? 'mi-nav-link-active' : ''"
          :aria-current="aktif(link.href) ? 'page' : undefined"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>

      <a
        v-if="waHref"
        :href="waHref"
        target="_blank"
        rel="noopener"
        class="mi-nav-cta ml-auto hidden md:ml-2 md:inline-flex"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 fill-current" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4 0-.5.2-.7l.4-.5c.1-.2.1-.3 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.9 2.9 4.6 4a15 15 0 0 0 1.5.6c.6.2 1.2.2 1.7.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3Z" />
        </svg>
        <span>Hubungi</span>
      </a>

      <!-- Tombol panel mobil. Selalu di kanan, ukurannya ≥44px (target sentuh). -->
      <button
        v-if="data.links.length"
        type="button"
        class="mi-nav-toggle md:hidden"
        :class="waHref ? '' : 'ml-auto'"
        :aria-expanded="terbuka"
        aria-controls="mi-nav-panel"
        :aria-label="terbuka ? 'Tutup menu' : 'Buka menu'"
        @click="terbuka = !terbuka"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <template v-if="terbuka">
            <path d="M6 6l12 12M18 6L6 18" />
          </template>
          <template v-else>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </template>
        </svg>
      </button>
    </div>

    <!-- Panel mobil: di dalam <header>, bukan teleport (lihat catatan di atas). -->
    <div
      v-show="terbuka"
      id="mi-nav-panel"
      class="mi-nav-panel md:hidden"
      data-testid="nav-panel"
    >
      <nav class="section-inner flex flex-col py-2" aria-label="Navigasi utama (mobil)">
        <NuxtLink
          v-for="link in data.links"
          :key="link.href"
          :to="tautan(link.href)"
          class="mi-nav-link-block"
          :class="aktif(link.href) ? 'mi-nav-link-active' : ''"
          :aria-current="aktif(link.href) ? 'page' : undefined"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>
