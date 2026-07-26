<script setup lang="ts">
/**
 * Pratinjau draft dalam iframe ke subdomain tenant + `?preview=1`
 * (PLAN-FRONTEND §7c.6) — render draft, selalu noindex. Bisa dilipat supaya
 * tidak memakan layar HP saat user sedang mengisi form.
 */
defineProps<{ url: string }>();

const open = ref(true);
</script>

<template>
  <div class="mt-4 overflow-hidden rounded-xl border border-slate-300 bg-white">
    <div class="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2">
      <button
        type="button"
        class="text-sm font-medium text-slate-600"
        :aria-expanded="open"
        @click="open = !open"
      >
        {{ open ? "▾" : "▸" }} Pratinjau
      </button>
      <a :href="url" target="_blank" rel="noopener" class="text-xs font-medium text-teal-700">
        Buka di tab baru ↗
      </a>
    </div>
    <iframe
      v-if="open"
      :src="url"
      title="Pratinjau situs"
      loading="lazy"
      class="h-[50vh] w-full border-0 bg-white"
    />
  </div>
</template>
