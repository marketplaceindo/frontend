<script setup lang="ts">
/**
 * Kaki situs. Sama seperti navbar, di-render sekali oleh `layouts/tenant.vue`
 * dari chrome yang diangkat keluar dari section (utils/site-chrome.ts) — dulu
 * block ini dan `<footer>` milik layout tampil bersamaan.
 *
 * Kontak (alamat + WhatsApp) datang dari `site.contact`, bukan dari data block,
 * supaya tidak ada dua sumber kebenaran untuk nomor yang sama.
 */
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "footer" }>["data"];

const props = defineProps<{
  data: Data;
  brandName?: string;
  address?: string;
  whatsapp?: string;
}>();

const { tautan } = useTenantLink();

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
};

const tahun = new Date().getFullYear();

/** Alamat block lebih spesifik daripada kontak tenant; block menang bila diisi. */
const alamat = computed(() => props.data.text || props.address || "");

const waHref = computed(() =>
  props.whatsapp ? `https://wa.me/${props.whatsapp}` : null,
);
</script>

<template>
  <footer class="mi-footer">
    <div class="section-inner py-10">
      <div class="flex flex-col gap-8 md:flex-row md:justify-between">
        <!-- Kolom identitas -->
        <div class="max-w-sm">
          <p v-if="brandName" class="font-heading text-lg font-bold">{{ brandName }}</p>
          <p v-if="alamat" class="mt-2 text-sm leading-relaxed" style="color: var(--color-muted)">
            {{ alamat }}
          </p>
          <a v-if="waHref" :href="waHref" target="_blank" rel="noopener" class="mi-footer-wa">
            <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 fill-current" aria-hidden="true">
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4 0-.5.2-.7l.4-.5c.1-.2.1-.3 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.9 2.9 4.6 4a15 15 0 0 0 1.5.6c.6.2 1.2.2 1.7.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3Z" />
            </svg>
            <span>Hubungi via WhatsApp</span>
          </a>
        </div>

        <!-- Kolom tautan -->
        <div v-if="data.links?.length || data.socials?.length" class="flex gap-12">
          <div v-if="data.links?.length">
            <p class="mi-eyebrow">Halaman</p>
            <ul class="mt-3 space-y-2">
              <li v-for="link in data.links" :key="link.href">
                <a :href="tautan(link.href)" class="text-sm">{{ link.label }}</a>
              </li>
            </ul>
          </div>
          <div v-if="data.socials?.length">
            <p class="mi-eyebrow">Ikuti kami</p>
            <ul class="mt-3 space-y-2">
              <li v-for="social in data.socials" :key="social.platform">
                <a :href="social.url" rel="noopener" target="_blank" class="text-sm">
                  {{ SOCIAL_LABELS[social.platform] ?? social.platform }}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <hr class="mi-divider my-8" />

      <div class="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p style="color: var(--color-muted)">
          © {{ tahun }}{{ brandName ? ` ${brandName}` : "" }}. Semua hak dilindungi.
        </p>
        <!-- Badge viral loop plan dasar: backlink dofollow ke domain utama. -->
        <p style="color: var(--color-muted)">
          Dibuat dengan
          <a href="https://marketindonesia.co.id" target="_blank" rel="noopener" class="font-semibold">
            MarketIndonesia
          </a>
        </p>
      </div>
    </div>
  </footer>
</template>
