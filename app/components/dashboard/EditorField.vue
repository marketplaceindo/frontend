<script setup lang="ts">
/**
 * Render satu field editor dari `FieldDescriptor` (yang diturunkan dari schema
 * Zod block shared). Rekursif untuk `list`: tiap item memakai komponen ini lagi
 * sehingga struktur bersarang (mis. `menu.groups[].items[]`) ikut ter-render
 * tanpa kode khusus per block.
 */
import type { ImageRef } from "@marketplaceindo/shared";
import type { FieldDescriptor } from "~/utils/block-form";
import EditorImageInput from "./EditorImageInput.vue";

const props = defineProps<{
  field: FieldDescriptor;
  modelValue: unknown;
  tenantId: string;
  /** Error per path relatif (mis. `items.0.name`) dari fieldErrors §1.4. */
  errors?: Record<string, string>;
  path?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [unknown] }>();

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";

const fullPath = computed(() => (props.path ? props.path : props.field.key));
const error = computed(() => props.errors?.[fullPath.value]);

/** List selalu diperlakukan sebagai array, termasuk objek tunggal (maxItems 1). */
const isSingleObject = computed(
  () => props.field.kind === "list" && props.field.maxItems === 1 && props.field.minItems === 1,
);

const list = computed<unknown[]>(() => {
  if (props.field.kind !== "list") return [];
  if (isSingleObject.value) return [props.modelValue ?? {}];
  return Array.isArray(props.modelValue) ? props.modelValue : [];
});

/** Item list berupa nilai tunggal (array of string), bukan objek. */
const scalarItem = computed(
  () => props.field.itemFields?.length === 1 && props.field.itemFields[0]!.key === "",
);

function update(value: unknown) {
  emit("update:modelValue", value);
}

function updateList(next: unknown[]) {
  if (isSingleObject.value) update(next[0]);
  else update(next);
}

function updateItem(index: number, value: unknown) {
  const next = [...list.value];
  next[index] = value;
  updateList(next);
}

function updateItemField(index: number, key: string, value: unknown) {
  const item = { ...((list.value[index] ?? {}) as Record<string, unknown>) };
  if (value === "" || value === undefined) delete item[key];
  else item[key] = value;
  updateItem(index, item);
}

function addItem() {
  updateList([...list.value, emptyItem(props.field)]);
}

function removeItem(index: number) {
  updateList(list.value.filter((_, i) => i !== index));
}

function moveItem(index: number, delta: number) {
  const next = [...list.value];
  const target = index + delta;
  if (target < 0 || target >= next.length) return;
  [next[index], next[target]] = [next[target], next[index]];
  updateList(next);
}

const canAdd = computed(
  () => !isSingleObject.value && list.value.length < (props.field.maxItems ?? 20),
);
const canRemove = computed(
  () => !isSingleObject.value && list.value.length > (props.field.minItems ?? 0),
);

/** Angka: kosongkan field → hapus nilai (bukan simpan NaN). */
function onNumber(raw: string) {
  const digits = props.field.kind === "money" ? raw.replace(/\D/g, "") : raw;
  update(digits === "" ? undefined : Number(digits));
}
</script>

<template>
  <div>
    <label v-if="field.kind !== 'boolean'" class="mb-1.5 block text-sm font-medium text-slate-700">
      {{ field.label }}
      <span v-if="field.optional" class="font-normal text-slate-400">(opsional)</span>
    </label>

    <!-- Teks & URL -->
    <input
      v-if="field.kind === 'text' || field.kind === 'url'"
      :value="modelValue ?? ''"
      :type="field.kind === 'url' ? 'url' : 'text'"
      :class="inputClass"
      @input="update(($event.target as HTMLInputElement).value)"
    />

    <textarea
      v-else-if="field.kind === 'textarea'"
      :value="(modelValue as string) ?? ''"
      rows="3"
      :class="inputClass"
      @input="update(($event.target as HTMLTextAreaElement).value)"
    />

    <!-- Angka & uang -->
    <div v-else-if="field.kind === 'money' || field.kind === 'number'" class="flex items-center gap-2">
      <span v-if="field.kind === 'money'" class="text-sm text-slate-500">Rp</span>
      <input
        :value="modelValue ?? ''"
        type="text"
        inputmode="numeric"
        :class="inputClass"
        @input="onNumber(($event.target as HTMLInputElement).value)"
      />
    </div>

    <label v-else-if="field.kind === 'boolean'" class="flex items-center gap-3 py-1">
      <input
        type="checkbox"
        :checked="!!modelValue"
        class="size-5 accent-teal-600"
        @change="update(($event.target as HTMLInputElement).checked)"
      />
      <span class="text-sm font-medium text-slate-700">{{ field.label }}</span>
    </label>

    <select
      v-else-if="field.kind === 'select'"
      :value="modelValue ?? ''"
      :class="inputClass"
      @change="update(($event.target as HTMLSelectElement).value || undefined)"
    >
      <option v-if="field.optional" value="">— tidak diatur —</option>
      <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
    </select>

    <EditorImageInput
      v-else-if="field.kind === 'image'"
      :model-value="modelValue as ImageRef | undefined"
      :tenant-id="tenantId"
      @update:model-value="update($event)"
    />

    <!-- List (array objek / array nilai / objek tunggal) -->
    <div v-else-if="field.kind === 'list'" class="space-y-3">
      <div
        v-for="(item, index) in list"
        :key="index"
        class="rounded-lg border border-slate-200 bg-slate-50 p-3"
      >
        <div v-if="!isSingleObject" class="mb-2 flex items-center justify-between">
          <span class="text-xs font-medium text-slate-500">#{{ index + 1 }}</span>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="rounded px-2 py-1 text-sm text-slate-500 disabled:opacity-30"
              :disabled="index === 0"
              aria-label="Naikkan"
              @click="moveItem(index, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="rounded px-2 py-1 text-sm text-slate-500 disabled:opacity-30"
              :disabled="index === list.length - 1"
              aria-label="Turunkan"
              @click="moveItem(index, 1)"
            >
              ↓
            </button>
            <button
              v-if="canRemove"
              type="button"
              class="rounded px-2 py-1 text-sm text-red-600"
              aria-label="Hapus"
              @click="removeItem(index)"
            >
              Hapus
            </button>
          </div>
        </div>

        <!-- Item bernilai tunggal (mis. daftar slug) -->
        <EditorField
          v-if="scalarItem"
          :field="{ ...field.itemFields![0]!, label: field.label, key: String(index) }"
          :model-value="item"
          :tenant-id="tenantId"
          :errors="errors"
          :path="`${fullPath}.${index}`"
          @update:model-value="updateItem(index, $event)"
        />

        <!-- Item berupa objek -->
        <div v-else class="space-y-3">
          <EditorField
            v-for="sub in field.itemFields"
            :key="sub.key"
            :field="sub"
            :model-value="(item as Record<string, unknown>)?.[sub.key]"
            :tenant-id="tenantId"
            :errors="errors"
            :path="isSingleObject ? `${fullPath}.${sub.key}` : `${fullPath}.${index}.${sub.key}`"
            @update:model-value="updateItemField(index, sub.key, $event)"
          />
        </div>
      </div>

      <button
        v-if="canAdd"
        type="button"
        class="w-full rounded-lg border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-600"
        @click="addItem"
      >
        + Tambah {{ field.label.toLowerCase() }}
      </button>
    </div>

    <p v-else class="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">
      Field ini belum bisa diubah dari editor.
    </p>

    <p v-if="error" class="mt-1.5 text-xs text-red-600">{{ error }}</p>
  </div>
</template>
