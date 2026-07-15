<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();

// Halaman error tidak pernah boleh diindeks.
useSeoMeta({ robots: "noindex, nofollow" });

const errorCode = computed(() => {
  const data = props.error.data as
    | { error?: { code?: string } }
    | string
    | undefined;
  if (typeof data === "string") {
    try {
      return (JSON.parse(data) as { error?: { code?: string } }).error?.code;
    } catch {
      return undefined;
    }
  }
  return data?.error?.code;
});

const view = computed(() => {
  if (props.error.statusCode === 410 || errorCode.value === "TENANT_SUSPENDED") {
    return {
      title: "Situs sedang dinonaktifkan",
      body: "Situs ini sementara tidak tersedia. Bila kamu pemilik situs, periksa status langganan di dashboard MarketIndonesia.",
    };
  }
  if (errorCode.value === "TENANT_NOT_FOUND") {
    return {
      title: "Situs tidak ditemukan",
      body: "Alamat subdomain ini tidak terdaftar. Periksa kembali penulisan alamatnya.",
    };
  }
  if (props.error.statusCode === 404) {
    return {
      title: "Halaman tidak ditemukan",
      body: "Halaman yang kamu cari tidak ada atau sudah dipindahkan.",
    };
  }
  return {
    title: "Terjadi kesalahan",
    body: "Maaf, ada gangguan di sisi kami. Silakan coba lagi beberapa saat lagi.",
  };
});
</script>

<template>
  <div class="error-shell">
    <p class="status">{{ error.statusCode }}</p>
    <h1>{{ view.title }}</h1>
    <p>{{ view.body }}</p>
  </div>
</template>

<style scoped>
.error-shell {
  max-width: 36rem;
  margin: 15vh auto 0;
  padding: 0 1rem;
  font-family: system-ui, sans-serif;
  text-align: center;
}
.status {
  font-size: 3rem;
  font-weight: 700;
  color: #9ca3af;
  margin-bottom: 0;
}
</style>
