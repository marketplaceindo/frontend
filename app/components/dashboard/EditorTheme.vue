<script setup lang="ts">
/**
 * Panel tema global (cascade Level 2, kontrak §3 PATCH /tenants/:id/theme).
 * Pratinjau langsung memakai token CSS yang sama dengan situs tenant, jadi
 * yang terlihat di sini benar-benar yang akan ter-render — lalu iframe preview
 * dimuat ulang setelah simpan untuk konfirmasi penuh.
 *
 * Susunannya sengaja: GAYA dulu, warna belakangan. Memilih satu preset sudah
 * menghasilkan situs yang layak tayang; tenant yang tidak peduli warna tidak
 * perlu menyentuh lima color picker untuk keluar dari tampilan bawaan.
 */
import { tenantThemeSchema, type TenantTheme } from "@marketplaceindo/shared";
import { THEME_PRESETS, THEME_PRESET_ORDER, applyThemePreset } from "~~/shared/utils/theme-presets";

const props = defineProps<{ tenantId: string; theme: TenantTheme }>();
const emit = defineEmits<{ saved: [TenantTheme] }>();

const { updateTheme } = useEditor();

const draft = ref<TenantTheme>({ ...props.theme });
const busy = ref(false);
const message = ref("");
const lanjutanTerbuka = ref(false);

const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(props.theme));

/** Font yang di-self-host (lihat theme-vars) — dimuat cepat, tanpa request pihak ketiga. */
const FONTS = ["Poppins", "Inter", "Plus Jakarta Sans"];
const RADIUS: { value: NonNullable<TenantTheme["radius"]>; label: string }[] = [
  { value: "none", label: "Siku" },
  { value: "sm", label: "Sedikit" },
  { value: "md", label: "Sedang" },
  { value: "lg", label: "Membulat" },
  { value: "full", label: "Kapsul" },
];
const CARD_STYLES: { value: NonNullable<TenantTheme["cardStyle"]>; label: string }[] = [
  { value: "flat", label: "Rata" },
  { value: "soft", label: "Bayangan lembut" },
  { value: "elevated", label: "Terangkat" },
  { value: "outlined", label: "Bergaris" },
];
const DENSITIES: { value: NonNullable<TenantTheme["density"]>; label: string }[] = [
  { value: "compact", label: "Rapat" },
  { value: "normal", label: "Normal" },
  { value: "roomy", label: "Lega" },
];

const COLOR_FIELDS = [
  { key: "primaryColor", label: "Warna utama", fallback: "#0d9488" },
  { key: "secondaryColor", label: "Warna kedua", fallback: "#0f172a" },
  { key: "accentColor", label: "Warna aksen", fallback: "#f59e0b" },
  { key: "backgroundColor", label: "Latar halaman", fallback: "#ffffff" },
  { key: "textColor", label: "Warna teks", fallback: "#111827" },
] as const;

/** Pratinjau memakai variabel & kelas CSS yang sama dengan `layouts/tenant.vue`. */
const previewVars = computed(() => themeToVars(draft.value));
const previewClass = computed(() => themeClasses(draft.value));

/**
 * Memilih preset menulis paletnya sebagai hex konkret ke draft — bukan sekadar
 * menyimpan namanya. Dengan begitu tenant bisa langsung menggeser satu warna
 * setelahnya tanpa kehilangan sisa gayanya.
 */
function pilihPreset(nama: keyof typeof THEME_PRESETS) {
  draft.value = applyThemePreset(draft.value, nama);
}

/** Kontras teks tombol dihitung dari warna utama — ditampilkan supaya tenant
    tahu kenapa label tombolnya berubah hitam saat memilih warna pucat. */
const kontrasOtomatis = computed(() =>
  draft.value.onPrimaryColor
    ? null
    : draft.value.primaryColor
      ? pickOnColor(draft.value.primaryColor)
      : null,
);

async function save() {
  message.value = "";
  const parsed = tenantThemeSchema.safeParse(draft.value);
  if (!parsed.success) {
    message.value = "Ada nilai tema yang tidak valid.";
    return;
  }
  busy.value = true;
  try {
    const tenant = await updateTheme(props.tenantId, parsed.data);
    emit("saved", tenant.themeJson);
    message.value = "Tampilan tersimpan.";
  } catch (err) {
    message.value = apiErrorOf(err).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Galeri gaya: satu ketuk mengubah seluruh nuansa situs -->
    <section>
      <h3 class="text-sm font-semibold text-slate-700">Gaya tampilan</h3>
      <p class="mt-0.5 text-xs text-slate-500">
        Pilih satu, lalu ubah warnanya kalau perlu.
      </p>

      <div class="mt-3 grid grid-cols-2 gap-2.5">
        <button
          v-for="nama in THEME_PRESET_ORDER"
          :key="nama"
          type="button"
          class="rounded-xl border p-2.5 text-left transition-colors"
          :class="
            draft.preset === nama
              ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-600'
              : 'border-slate-200 hover:border-slate-300'
          "
          :aria-pressed="draft.preset === nama"
          @click="pilihPreset(nama)"
        >
          <!-- Contekan warna: tiga swatch dari palet preset itu sendiri, jadi
               yang terlihat di tombol memang yang akan dipakai. -->
          <span class="flex gap-1" aria-hidden="true">
            <span
              v-for="warna in [
                THEME_PRESETS[nama].palette.backgroundColor,
                THEME_PRESETS[nama].palette.primaryColor,
                THEME_PRESETS[nama].palette.accentColor,
              ]"
              :key="warna"
              class="h-6 flex-1 rounded border border-slate-200"
              :style="{ background: warna }"
            />
          </span>
          <span class="mt-2 block text-sm font-semibold text-slate-900">
            {{ THEME_PRESETS[nama].label }}
          </span>
          <span class="mt-0.5 block text-xs leading-snug text-slate-500">
            {{ THEME_PRESETS[nama].description }}
          </span>
        </button>
      </div>
    </section>

    <!-- Pratinjau token: warna, font, DAN lapisan bentuk persis seperti di situs -->
    <section>
      <h3 class="mb-2 text-sm font-semibold text-slate-700">Pratinjau</h3>
      <!-- `.mi-tokens`, bukan `.tenant-shell`: token & knob yang sama tanpa
           min-height 100vh yang akan memanjangkan kotak pratinjau. -->
      <div
        class="mi-tokens overflow-hidden rounded-xl border border-slate-200"
        :class="previewClass"
        :style="previewVars"
      >
        <div class="p-5" style="background: var(--color-bg); color: var(--color-text)">
          <p class="mi-eyebrow">Mobil baru</p>
          <p class="mt-1 text-xl font-bold" style="font-family: var(--font-heading)">
            Judul halaman
          </p>
          <p class="mt-1 text-sm" style="color: var(--color-muted)">
            Teks isi memakai font &amp; warna tema.
          </p>

          <div class="mi-card mt-4 p-3">
            <p class="text-sm font-semibold">Contoh kartu</p>
            <p class="mt-1 text-sm font-bold" style="color: var(--color-primary)">Rp250.000.000</p>
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-2">
            <span class="mi-cta rounded-theme bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
              Tombol utama
            </span>
            <span class="mi-chip">Chip</span>
            <span class="mi-badge">Badge</span>
          </div>
        </div>
      </div>
      <p v-if="kontrasOtomatis" class="mt-1.5 text-xs text-slate-500">
        Teks tombol utama dipilih otomatis
        <strong>{{ kontrasOtomatis === "#ffffff" ? "putih" : "gelap" }}</strong>
        agar terbaca di atas warna utamamu.
      </p>
    </section>

    <!-- Warna: setelah gaya, karena preset sudah mengisinya -->
    <section class="space-y-3">
      <h3 class="text-sm font-semibold text-slate-700">Warna</h3>
      <div
        v-for="field in COLOR_FIELDS"
        :key="field.key"
        class="flex items-center justify-between gap-3"
      >
        <span class="text-sm text-slate-700">{{ field.label }}</span>
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs text-slate-500">{{ draft[field.key] ?? "—" }}</span>
          <input
            :value="draft[field.key] ?? field.fallback"
            type="color"
            class="h-10 w-14 rounded border border-slate-300"
            :aria-label="field.label"
            @input="draft[field.key] = ($event.target as HTMLInputElement).value"
          />
        </div>
      </div>
    </section>

    <!-- Lanjutan: ditutup default supaya panel tidak terasa seperti formulir
         panjang bagi tenant yang cukup dengan preset. -->
    <section>
      <button
        type="button"
        class="flex w-full items-center justify-between py-1 text-sm font-semibold text-slate-700"
        :aria-expanded="lanjutanTerbuka"
        @click="lanjutanTerbuka = !lanjutanTerbuka"
      >
        <span>Pengaturan lanjutan</span>
        <span aria-hidden="true">{{ lanjutanTerbuka ? "−" : "+" }}</span>
      </button>

      <div v-if="lanjutanTerbuka" class="mt-3 space-y-4">
        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">Font judul</span>
          <select
            v-model="draft.fontHeading"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base"
          >
            <option v-for="f in FONTS" :key="f" :value="f">{{ f }}</option>
          </select>
        </label>

        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">Font isi</span>
          <select
            v-model="draft.fontBody"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base"
          >
            <option v-for="f in FONTS" :key="f" :value="f">{{ f }}</option>
          </select>
        </label>

        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">Kelengkungan sudut</span>
          <select
            v-model="draft.radius"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base"
          >
            <option v-for="r in RADIUS" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </label>

        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">Gaya kartu</span>
          <select
            v-model="draft.cardStyle"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base"
          >
            <option v-for="c in CARD_STYLES" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
        </label>

        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">Kerapatan</span>
          <select
            v-model="draft.density"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base"
          >
            <option v-for="d in DENSITIES" :key="d.value" :value="d.value">{{ d.label }}</option>
          </select>
        </label>

        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-slate-700">
            Teks tombol utama
            <span class="block text-xs text-slate-500">Kosongkan untuk otomatis</span>
          </span>
          <div class="flex items-center gap-2">
            <button
              v-if="draft.onPrimaryColor"
              type="button"
              class="text-xs font-medium text-teal-700 underline"
              @click="draft.onPrimaryColor = undefined"
            >
              Otomatis
            </button>
            <input
              :value="draft.onPrimaryColor ?? kontrasOtomatis ?? '#ffffff'"
              type="color"
              class="h-10 w-14 rounded border border-slate-300"
              aria-label="Warna teks tombol utama"
              @input="draft.onPrimaryColor = ($event.target as HTMLInputElement).value"
            />
          </div>
        </div>
      </div>
    </section>

    <p
      v-if="message"
      class="rounded-lg px-3 py-2 text-sm"
      :class="message.includes('tersimpan') ? 'bg-teal-50 text-teal-800' : 'bg-red-50 text-red-700'"
    >
      {{ message }}
    </p>

    <button
      type="button"
      :disabled="busy || !dirty"
      class="w-full rounded-lg bg-teal-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
      @click="save"
    >
      {{ busy ? "Menyimpan…" : "Simpan tampilan" }}
    </button>
  </div>
</template>
