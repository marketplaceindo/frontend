<script setup lang="ts">
/**
 * Input gambar: pilih file → perkecil di browser → presign → PUT ke object
 * storage (kontrak §6) → simpan `{ mediaId, url }` ke data block.
 * Preview memakai URL hasil upload, jadi yang dilihat editor = yang dilihat
 * pengunjung situs.
 */
import type { ImageRef } from "@marketplaceindo/shared";

const props = defineProps<{
  modelValue: ImageRef | undefined;
  tenantId: string;
  label?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [ImageRef | undefined] }>();

const { uploadImage } = useEditor();
const busy = ref(false);
const error = ref("");
const input = ref<HTMLInputElement>();

async function onPick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  error.value = "";
  busy.value = true;
  try {
    const resized = await resizeImage(file);
    const { mediaId, url } = await uploadImage(props.tenantId, resized);
    emit("update:modelValue", { mediaId, url, alt: props.modelValue?.alt ?? "" });
  } catch (err) {
    error.value = apiErrorOf(err).message;
  } finally {
    busy.value = false;
    if (input.value) input.value.value = "";
  }
}

function clear() {
  emit("update:modelValue", undefined);
}

function setAlt(alt: string) {
  if (props.modelValue) emit("update:modelValue", { ...props.modelValue, alt });
}
</script>

<template>
  <div>
    <div v-if="modelValue?.url" class="overflow-hidden rounded-lg border border-slate-200">
      <img :src="modelValue.url" :alt="modelValue.alt ?? ''" class="h-40 w-full object-cover" />
      <div class="space-y-2 p-3">
        <input
          :value="modelValue.alt ?? ''"
          type="text"
          placeholder="Keterangan gambar (untuk SEO & pembaca layar)"
          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          @input="setAlt(($event.target as HTMLInputElement).value)"
        />
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-md border border-slate-300 py-2 text-sm font-medium"
            :disabled="busy"
            @click="input?.click()"
          >
            Ganti
          </button>
          <button
            type="button"
            class="rounded-md border border-slate-300 px-3 py-2 text-sm text-red-600"
            @click="clear"
          >
            Hapus
          </button>
        </div>
      </div>
    </div>

    <button
      v-else
      type="button"
      :disabled="busy"
      class="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white py-6 text-sm font-medium text-slate-600 disabled:opacity-60"
      @click="input?.click()"
    >
      <span aria-hidden="true">🖼️</span>
      {{ busy ? "Mengunggah…" : (label ?? "Pilih gambar") }}
    </button>

    <input
      ref="input"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="hidden"
      @change="onPick"
    />
    <p v-if="error" class="mt-1.5 text-xs text-red-600">{{ error }}</p>
  </div>
</template>
