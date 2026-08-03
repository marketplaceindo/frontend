<script setup lang="ts">
/**
 * Daftar gambar dengan urutan — membungkus `EditorImageInput` (satu gambar)
 * tanpa mengubahnya, karena komponen itu juga dipakai editor block.
 *
 * Urutan penting: gambar pertama dipakai sebagai thumbnail kartu model dan
 * gambar hero di halaman model. Reorder memakai tombol naik/turun, bukan
 * drag — di layar 360px drag bersaing dengan gestur scroll.
 */
import type { ImageRef } from "@marketplaceindo/shared";
import EditorImageInput from "./EditorImageInput.vue";

const props = defineProps<{
  modelValue: ImageRef[];
  tenantId: string;
  /** Batas jumlah gambar (schema model: maks 20). */
  max?: number;
}>();

const emit = defineEmits<{ "update:modelValue": [ImageRef[]] }>();

const batas = computed(() => props.max ?? 20);

function set(index: number, value: ImageRef | undefined) {
  const next = [...props.modelValue];
  if (value === undefined) next.splice(index, 1);
  else next[index] = value;
  emit("update:modelValue", next);
}

function tambah() {
  if (props.modelValue.length >= batas.value) return;
  emit("update:modelValue", [...props.modelValue, { url: "", alt: "" }]);
}

function pindah(index: number, arah: -1 | 1) {
  const target = index + arah;
  if (target < 0 || target >= props.modelValue.length) return;
  const next = [...props.modelValue];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item!);
  emit("update:modelValue", next);
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="(image, i) in modelValue"
      :key="i"
      class="rounded-lg border border-slate-200 p-3"
    >
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-slate-500">
          Gambar {{ i + 1 }}<template v-if="i === 0"> · dipakai sebagai thumbnail</template>
        </span>
        <div class="flex gap-1">
          <button
            type="button"
            class="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
            :disabled="i === 0"
            :aria-label="`Naikkan gambar ${i + 1}`"
            @click="pindah(i, -1)"
          >
            ↑
          </button>
          <button
            type="button"
            class="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
            :disabled="i === modelValue.length - 1"
            :aria-label="`Turunkan gambar ${i + 1}`"
            @click="pindah(i, 1)"
          >
            ↓
          </button>
        </div>
      </div>

      <EditorImageInput
        class="mt-2"
        :tenant-id="tenantId"
        :model-value="image"
        @update:model-value="set(i, $event)"
      />
    </div>

    <button
      v-if="modelValue.length < batas"
      type="button"
      class="w-full rounded-lg border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600"
      @click="tambah"
    >
      + Tambah gambar
    </button>
  </div>
</template>
