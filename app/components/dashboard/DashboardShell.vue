<script setup lang="ts">
/** Chrome dashboard terautentikasi: top bar + area konten. Mobile-first. */
const { user, logout } = useAuth();

async function onLogout() {
  await logout();
  await navigateTo("/login", { replace: true });
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <header class="sticky top-0 z-10 border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <strong class="text-sm">MarketIndonesia</strong>
        <div class="flex items-center gap-3">
          <span class="max-w-[40vw] truncate text-sm text-slate-500">{{ user?.name }}</span>
          <button
            type="button"
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
            @click="onLogout"
          >
            Keluar
          </button>
        </div>
      </div>
    </header>
    <main class="mx-auto max-w-3xl px-4 py-6">
      <slot />
    </main>
  </div>
</template>
