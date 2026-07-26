<script setup lang="ts">
/**
 * Satu section di editor halaman: toggle aktif, geser urutan, ubah gaya
 * (cascade Level 3), dan edit block-nya lewat form yang di-generate dari schema.
 * Validasi dua arah: `blockSchema` shared di klien, lalu server memvalidasi
 * ulang dan mengembalikan `fieldErrors` ber-index yang dipetakan balik ke field.
 */
import {
  blockSchema,
  sectionStyleSchema,
  type Block,
  type SectionStyle,
} from "@marketplaceindo/shared";
import EditorField from "./EditorField.vue";

const props = defineProps<{
  pageId: string;
  tenantId: string;
  section: { id: string; sectionKey: string; order: number; enabled: boolean; styleJson: SectionStyle; blocks: Block[] };
  isFirst: boolean;
  isLast: boolean;
}>();

const emit = defineEmits<{ changed: [] }>();

const { updateSection, saveBlocks } = useEditor();

const open = ref(false);
const busy = ref(false);
const message = ref("");
const errors = ref<Record<string, string>>({});
const dirty = ref(false);

/** Salinan lokal supaya ketikan tidak langsung menembak API tiap huruf. */
const draft = ref<Block[]>(structuredClone(toRaw(props.section.blocks)));
const style = ref<SectionStyle>(structuredClone(toRaw(props.section.styleJson)));

watch(
  () => props.section.blocks,
  (next) => {
    if (!dirty.value) draft.value = structuredClone(toRaw(next));
  },
);

const SECTION_LABELS: Record<string, string> = {
  navbar: "Menu atas",
  hero: "Sampul utama",
  highlights: "Andalan",
  about: "Tentang kami",
  opening_hours: "Jam buka",
  cta_band: "Ajakan menghubungi",
  contact: "Kontak & lokasi",
  footer: "Bagian bawah",
  menu: "Daftar menu",
};
const label = computed(() => SECTION_LABELS[props.section.sectionKey] ?? props.section.sectionKey);

const fieldsByBlock = computed(() => draft.value.map((block) => describeBlockFields(block.type)));

function setBlockField(blockIndex: number, key: string, value: unknown) {
  const block = draft.value[blockIndex];
  if (!block) return;
  const data = { ...(block.data as Record<string, unknown>) };
  if (value === "" || value === undefined) delete data[key];
  else data[key] = value;
  draft.value[blockIndex] = { ...block, data } as Block;
  dirty.value = true;
}

async function toggle() {
  busy.value = true;
  try {
    await updateSection(props.pageId, props.section.id, { enabled: !props.section.enabled });
    emit("changed");
  } catch (err) {
    message.value = apiErrorOf(err).message;
  } finally {
    busy.value = false;
  }
}

async function move(delta: number) {
  busy.value = true;
  try {
    await updateSection(props.pageId, props.section.id, { order: props.section.order + delta });
    emit("changed");
  } catch (err) {
    message.value = apiErrorOf(err).message;
  } finally {
    busy.value = false;
  }
}

async function save() {
  errors.value = {};
  message.value = "";

  // Validasi klien lebih dulu — error tampil tanpa menunggu jaringan.
  for (const [i, block] of draft.value.entries()) {
    const parsed = blockSchema.safeParse(block);
    if (!parsed.success) {
      errors.value = Object.fromEntries(
        parsed.error.issues.map((issue) => [
          `${i}.${issue.path.slice(1).join(".")}`,
          issue.message,
        ]),
      );
      message.value = "Ada isian yang belum benar.";
      return;
    }
  }

  busy.value = true;
  try {
    const styleParsed = sectionStyleSchema.safeParse(style.value);
    if (styleParsed.success) {
      await updateSection(props.pageId, props.section.id, { styleJson: styleParsed.data });
    }
    await saveBlocks(props.pageId, props.section.id, draft.value);
    dirty.value = false;
    message.value = "Tersimpan.";
    emit("changed");
  } catch (err) {
    const e = apiErrorOf(err);
    if (e.fieldErrors) {
      // Server mengirim `blocks.0.data.heading` → editor memakai `0.heading`.
      errors.value = Object.fromEntries(
        Object.entries(e.fieldErrors).map(([path, msgs]) => [
          path.replace(/^blocks\.(\d+)\.data\./, "$1."),
          msgs[0] ?? "",
        ]),
      );
    }
    message.value = e.message;
  } finally {
    busy.value = false;
  }
}

function reset() {
  draft.value = structuredClone(toRaw(props.section.blocks));
  style.value = structuredClone(toRaw(props.section.styleJson));
  dirty.value = false;
  errors.value = {};
  message.value = "";
}

const PADDING_OPTIONS = ["none", "sm", "md", "lg"] as const;
const ALIGN_OPTIONS = ["left", "center", "right"] as const;
</script>

<template>
  <li class="rounded-xl border border-slate-200 bg-white">
    <div class="flex items-center gap-2 p-3">
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-2 text-left"
        :aria-expanded="open"
        @click="open = !open"
      >
        <span class="text-slate-400" aria-hidden="true">{{ open ? "▾" : "▸" }}</span>
        <span class="min-w-0">
          <span class="block truncate font-medium text-slate-900">{{ label }}</span>
          <span class="block text-xs text-slate-500">
            {{ section.blocks.map((b) => b.type).join(", ") || "kosong" }}
          </span>
        </span>
      </button>

      <span v-if="dirty" class="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
        belum disimpan
      </span>

      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          class="rounded px-2 py-1 text-slate-500 disabled:opacity-30"
          :disabled="isFirst || busy"
          aria-label="Naikkan section"
          @click="move(-1)"
        >
          ↑
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 text-slate-500 disabled:opacity-30"
          :disabled="isLast || busy"
          aria-label="Turunkan section"
          @click="move(1)"
        >
          ↓
        </button>
        <button
          type="button"
          role="switch"
          :aria-checked="section.enabled"
          :aria-label="`Tampilkan ${label}`"
          :disabled="busy"
          class="relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50"
          :class="section.enabled ? 'bg-teal-600' : 'bg-slate-300'"
          @click="toggle"
        >
          <span
            class="absolute top-0.5 size-5 rounded-full bg-white transition-all"
            :class="section.enabled ? 'left-[22px]' : 'left-0.5'"
          />
        </button>
      </div>
    </div>

    <div v-if="open" class="border-t border-slate-200 p-3">
      <p
        v-if="!section.enabled"
        class="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600"
      >
        Bagian ini sedang disembunyikan dari situs.
      </p>

      <div v-for="(block, i) in draft" :key="i" class="mb-4 space-y-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {{ block.type }}
        </p>
        <EditorField
          v-for="field in fieldsByBlock[i]"
          :key="field.key"
          :field="field"
          :model-value="(block.data as Record<string, unknown>)[field.key]"
          :tenant-id="tenantId"
          :errors="errors"
          :path="`${i}.${field.key}`"
          @update:model-value="setBlockField(i, field.key, $event)"
        />
      </div>

      <!-- Gaya per-section = cascade Level 3 (menang atas tema global) -->
      <details class="mt-4 rounded-lg border border-slate-200 p-3">
        <summary class="cursor-pointer text-sm font-medium text-slate-700">Gaya bagian ini</summary>
        <div class="mt-3 space-y-3">
          <label class="block">
            <span class="mb-1 block text-sm text-slate-600">Warna latar</span>
            <div class="flex items-center gap-2">
              <input
                :value="style.backgroundColor ?? '#ffffff'"
                type="color"
                class="h-10 w-14 rounded border border-slate-300"
                @input="style.backgroundColor = ($event.target as HTMLInputElement).value; dirty = true"
              />
              <button
                type="button"
                class="text-xs text-slate-500 underline"
                @click="delete style.backgroundColor; dirty = true"
              >
                pakai tema
              </button>
            </div>
          </label>
          <label class="block">
            <span class="mb-1 block text-sm text-slate-600">Warna teks</span>
            <div class="flex items-center gap-2">
              <input
                :value="style.textColor ?? '#111827'"
                type="color"
                class="h-10 w-14 rounded border border-slate-300"
                @input="style.textColor = ($event.target as HTMLInputElement).value; dirty = true"
              />
              <button
                type="button"
                class="text-xs text-slate-500 underline"
                @click="delete style.textColor; dirty = true"
              >
                pakai tema
              </button>
            </div>
          </label>
          <label class="block">
            <span class="mb-1 block text-sm text-slate-600">Perataan</span>
            <select
              :value="style.align ?? ''"
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              @change="style.align = (($event.target as HTMLSelectElement).value || undefined) as SectionStyle['align']; dirty = true"
            >
              <option value="">— tema —</option>
              <option v-for="a in ALIGN_OPTIONS" :key="a" :value="a">{{ a }}</option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1 block text-sm text-slate-600">Jarak atas-bawah</span>
            <select
              :value="style.paddingY ?? ''"
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              @change="style.paddingY = (($event.target as HTMLSelectElement).value || undefined) as SectionStyle['paddingY']; dirty = true"
            >
              <option value="">— tema —</option>
              <option v-for="p in PADDING_OPTIONS" :key="p" :value="p">{{ p }}</option>
            </select>
          </label>
        </div>
      </details>

      <p
        v-if="message"
        class="mt-3 rounded-lg px-3 py-2 text-sm"
        :class="message === 'Tersimpan.' ? 'bg-teal-50 text-teal-800' : 'bg-red-50 text-red-700'"
      >
        {{ message }}
      </p>

      <div class="mt-4 flex gap-2">
        <button
          type="button"
          :disabled="busy"
          class="flex-1 rounded-lg bg-teal-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
          @click="save"
        >
          {{ busy ? "Menyimpan…" : "Simpan" }}
        </button>
        <button
          v-if="dirty"
          type="button"
          class="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium"
          @click="reset"
        >
          Batal
        </button>
      </div>
    </div>
  </li>
</template>
