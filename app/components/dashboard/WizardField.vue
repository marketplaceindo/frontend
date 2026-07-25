<script setup lang="ts">
/**
 * Field form wizard — label, kontrol (slot), hint, dan pesan error.
 * Mobile-first: target sentuh besar (py-3), font 16px agar iOS/Android tidak
 * auto-zoom saat fokus.
 */
defineProps<{
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
}>();
</script>

<template>
  <div>
    <label class="mb-1.5 block text-sm font-medium text-slate-700">
      {{ label }}
      <span v-if="optional" class="font-normal text-slate-400">(opsional)</span>
    </label>
    <slot />
    <p v-if="error" class="mt-1.5 text-xs text-red-600">{{ error }}</p>
    <p v-else-if="hint" class="mt-1.5 text-xs text-slate-500">{{ hint }}</p>
  </div>
</template>
