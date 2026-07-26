<script setup lang="ts">
/**
 * Panel tema global (cascade Level 2, kontrak §3 PATCH /tenants/:id/theme).
 * Pratinjau langsung memakai token CSS yang sama dengan situs tenant, jadi
 * yang terlihat di sini benar-benar yang akan ter-render — lalu iframe preview
 * dimuat ulang setelah simpan untuk konfirmasi penuh.
 */
import { tenantThemeSchema, type TenantTheme } from "@marketplaceindo/shared";

const props = defineProps<{ tenantId: string; theme: TenantTheme }>();
const emit = defineEmits<{ saved: [TenantTheme] }>();

const { updateTheme } = useEditor();

const draft = ref<TenantTheme>({ ...props.theme });
const busy = ref(false);
const message = ref("");

const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(props.theme));

/** Font yang di-self-host (lihat theme-vars) — dimuat cepat, tanpa request pihak ketiga. */
const FONTS = ["Poppins", "Inter", "Plus Jakarta Sans"];
const RADIUS: NonNullable<TenantTheme["radius"]>[] = ["none", "sm", "md", "lg", "full"];

const COLOR_FIELDS = [
  { key: "primaryColor", label: "Warna utama", fallback: "#0d9488" },
  { key: "secondaryColor", label: "Warna kedua", fallback: "#0f172a" },
  { key: "accentColor", label: "Warna aksen", fallback: "#f59e0b" },
  { key: "backgroundColor", label: "Latar halaman", fallback: "#ffffff" },
  { key: "textColor", label: "Warna teks", fallback: "#111827" },
] as const;

/** Pratinjau memakai variabel CSS yang sama dengan `layouts/tenant.vue`. */
const previewVars = computed(() => themeToVars(draft.value));

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
  <div class="space-y-4">
    <!-- Pratinjau token: warna & font persis seperti di situs -->
    <div
      class="overflow-hidden rounded-xl border border-slate-200"
      :style="previewVars"
    >
      <div
        class="p-5"
        style="background: var(--color-bg); color: var(--color-text); font-family: var(--font-body)"
      >
        <p class="text-xs opacity-60">Pratinjau</p>
        <p class="mt-1 text-xl font-bold" style="font-family: var(--font-heading)">
          Judul halaman
        </p>
        <p class="mt-1 text-sm opacity-80">Teks isi memakai font & warna tema.</p>
        <span
          class="mt-3 inline-block px-4 py-2 text-sm font-semibold text-white"
          style="background: var(--color-primary); border-radius: var(--radius-theme)"
        >
          Tombol utama
        </span>
      </div>
    </div>

    <div v-for="field in COLOR_FIELDS" :key="field.key" class="flex items-center justify-between gap-3">
      <span class="text-sm font-medium text-slate-700">{{ field.label }}</span>
      <div class="flex items-center gap-2">
        <span class="font-mono text-xs text-slate-500">
          {{ draft[field.key] ?? "—" }}
        </span>
        <input
          :value="draft[field.key] ?? field.fallback"
          type="color"
          class="h-10 w-14 rounded border border-slate-300"
          :aria-label="field.label"
          @input="draft[field.key] = ($event.target as HTMLInputElement).value"
        />
      </div>
    </div>

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
        <option v-for="r in RADIUS" :key="r" :value="r">{{ r }}</option>
      </select>
    </label>

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
