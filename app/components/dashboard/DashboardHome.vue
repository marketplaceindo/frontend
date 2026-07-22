<script setup lang="ts">
import DashboardShell from "./DashboardShell.vue";

const { user } = useAuth();

// Daftar tenant milik user (GET /api/tenants) menyusul Fase 7b bersama wizard;
// Fase 7a menampilkan empty state + jalur memulai.
</script>

<template>
  <DashboardShell>
    <h1 class="text-xl font-bold">Halo, {{ user?.name }} 👋</h1>
    <p class="mt-1 text-sm text-slate-500">Kelola situs usahamu dari sini.</p>

    <section class="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
      <p class="font-medium">Kamu belum punya situs</p>
      <p class="mt-1 text-sm text-slate-500">
        Buat situs usaha dalam beberapa menit — jawab beberapa pertanyaan, situs
        langsung jadi.
      </p>
      <NuxtLink
        to="/onboarding"
        class="mt-4 inline-block rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
      >
        Mulai buat situs
      </NuxtLink>
    </section>
  </DashboardShell>
</template>
