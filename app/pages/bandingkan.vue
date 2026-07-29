<script setup lang="ts">
/**
 * Halaman perbandingan varian (`/bandingkan`, addendum Fase 5B).
 *
 * Ini halaman SSR ber-URL, bukan modal — alasannya bisnis: use case utamanya
 * adalah **sales mengirim link perbandingan ke calon pembeli lewat WhatsApp**.
 * Kalau compare cuma state di client, tidak ada yang bisa dikirim.
 */
import type { RenderCompareResponse, RenderTenantResponse } from "@marketplaceindo/shared";
import { defaultHanyaPerbedaan } from "@marketplaceindo/shared";

definePageMeta({ layout: false });

const route = useRoute();
const routing = useTenantRouting();
const requestFetch = useRequestFetch();
const kota = useKotaAktif();
const compare = useCompare();

const isPreview = computed(() => route.query.preview === "1");
const vParam = computed(() => String(route.query.v ?? ""));

const { data, error } = await useAsyncData(
  () => `compare:${vParam.value}:${kota.value}:${isPreview.value ? "p" : "l"}`,
  async () => {
    if (routing.value.mode !== "tenant") {
      throw createError({ statusCode: 404, message: "Halaman tidak ditemukan" });
    }
    const [site, compareData] = await Promise.all([
      requestFetch<RenderTenantResponse>("/api/_render/site", {
        query: isPreview.value ? { preview: "1" } : {},
      }),
      requestFetch<RenderCompareResponse>("/api/_render/compare", {
        query: {
          v: vParam.value,
          ...(kota.value ? { city: kota.value } : {}),
          ...(isPreview.value ? { preview: "1" } : {}),
        },
      }),
    ]);
    return { site, compare: compareData };
  },
);
if (error.value) rethrowRenderError(error.value);

const tenantSite = useTenantSite();
watchEffect(() => {
  tenantSite.value = data.value?.site ?? null;
});

const kolom = computed(() => data.value?.compare.variants ?? []);

// Default aktif kalau ≥3 kolom — dengan 2 kolom user justru ingin lihat semua.
const hanyaBeda = ref(false);
watchEffect(() => {
  hanyaBeda.value = defaultHanyaPerbedaan(kolom.value.length);
});

const baris = computed(() => {
  const rows = data.value?.compare.specRows ?? [];
  return hanyaBeda.value ? rows.filter((r) => !r.identical) : rows;
});

/** Render nilai: bedakan "tidak punya fitur" (Tidak) dari "belum diisi" (—). */
function tampil(row: (typeof baris.value)[number], i: number): string {
  const v = row.values[i];
  if (v === undefined || v === null) return "—";
  if (typeof v === "boolean") return v ? "✓" : "✗";
  if (typeof v === "number") {
    return row.unit ? `${v.toLocaleString("id-ID")} ${row.unit}` : v.toLocaleString("id-ID");
  }
  return String(v);
}

// Dibaca di setup, bukan di dalam computed: komposabel Nuxt harus dipanggil
// saat setup supaya SSR dan klien menghasilkan origin yang sama.
const origin = useRequestURL().origin;

const shareHref = computed(() => {
  const wa = data.value?.site.contact.whatsapp;
  const url = `${origin}/bandingkan?v=${data.value?.compare.canonicalV ?? ""}`;
  const nama = kolom.value.map((k) => `${k.modelName} ${k.variantName}`).join(" vs ");
  const pesan = `Perbandingan ${nama}:\n${url}`;
  return wa
    ? `https://wa.me/?text=${encodeURIComponent(pesan)}`
    : `https://wa.me/?text=${encodeURIComponent(url)}`;
});

// Kombinasi tumbuh kombinatorial & isinya tipis → default noindex (§Fase 6).
useTenantSeo({
  title: () =>
    kolom.value.length
      ? `Bandingkan ${kolom.value.map((k) => `${k.modelName} ${k.variantName}`).join(" vs ")}`
      : "Bandingkan Varian",
  description: () => "Perbandingan spesifikasi dan harga antar varian.",
  noindex: () => !data.value?.compare.curated,
});
</script>

<template>
  <NuxtLayout v-if="data" name="tenant" :site="data.site" :preview="isPreview">
    <div class="section-shell">
      <div class="section-inner py-8 md:py-12">
        <h1 class="text-2xl font-bold md:text-3xl">Bandingkan Varian</h1>
        <p class="mt-1 text-sm opacity-70">Harga OTR {{ data.compare.city?.name }}</p>

        <!-- Param kosong → arahkan memilih, bukan halaman kosong (§5B.10) -->
        <div v-if="!kolom.length" class="mt-8 rounded-theme border border-text/10 p-6 text-center">
          <p class="font-medium">Belum ada varian yang dipilih</p>
          <p class="mt-1 text-sm opacity-70">
            Pilih varian lewat tombol “Bandingkan” di daftar mobil.
          </p>
          <NuxtLink to="/mobil" :class="ctaClass('primary')" class="mt-4">Lihat mobil</NuxtLink>
        </div>

        <template v-else>
          <div class="mt-4 flex flex-wrap items-center gap-4">
            <label class="flex items-center gap-2 text-sm">
              <input v-model="hanyaBeda" type="checkbox" class="size-4 accent-primary" />
              Tampilkan perbedaan saja
            </label>
            <a :href="shareHref" target="_blank" rel="noopener" class="text-sm font-semibold text-primary">
              Kirim perbandingan ini via WhatsApp →
            </a>
          </div>

          <!-- Tabel: kolom label sticky kiri, header varian sticky atas -->
          <div class="mt-6 overflow-x-auto" style="scroll-snap-type: x mandatory">
            <table class="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr>
                  <th
                    class="sticky left-0 z-20 min-w-[9rem] border-b border-text/10 bg-bg p-3 text-left"
                  >
                    Spesifikasi
                  </th>
                  <th
                    v-for="k in kolom"
                    :key="`${k.modelSlug}:${k.variantSlug}`"
                    class="min-w-[11rem] border-b border-text/10 bg-bg p-3 text-left align-top"
                    style="scroll-snap-align: start"
                  >
                    <span class="block text-xs opacity-70">{{ k.brand }} {{ k.modelName }}</span>
                    <span class="block font-semibold">{{ k.variantName }}</span>
                    <span class="mt-1 block font-bold text-primary">
                      {{ k.price ? formatRupiah(k.price.price) : "—" }}
                    </span>
                    <button
                      type="button"
                      class="mt-1 text-xs opacity-70"
                      @click="compare.remove({ modelSlug: k.modelSlug, variantSlug: k.variantSlug })"
                    >
                      Hapus
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in baris" :key="row.key" class="border-b border-text/10">
                  <th class="sticky left-0 z-10 bg-bg p-3 text-left font-medium">{{ row.label }}</th>
                  <td
                    v-for="(_, i) in kolom"
                    :key="i"
                    class="p-3"
                    :class="row.winners?.includes(i) ? 'font-bold text-primary' : ''"
                  >
                    {{ tampil(row, i) }}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td class="sticky left-0 z-10 bg-bg p-3"></td>
                  <td v-for="k in kolom" :key="`cta-${k.variantSlug}`" class="p-3">
                    <NuxtLink
                      :to="`/mobil/${k.modelSlug}/${k.variantSlug}`"
                      class="block text-sm font-semibold text-primary"
                    >
                      Lihat varian →
                    </NuxtLink>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p v-if="data.compare.ignored.length" class="mt-4 text-xs opacity-70">
            {{ data.compare.ignored.length }} varian dilewati karena tidak ditemukan.
          </p>
        </template>
      </div>
    </div>
  </NuxtLayout>
</template>
