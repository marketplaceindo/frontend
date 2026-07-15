// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2026-07-15",
  devtools: { enabled: false },

  typescript: {
    strict: true,
  },

  vite: {
    server: {
      // Dev multi-subdomain: izinkan *.lvh.me (wildcard DNS → 127.0.0.1)
      // dan *.localhost menembus proteksi host-check Vite.
      allowedHosts: [".lvh.me", ".localhost", "localhost"],
    },
  },

  runtimeConfig: {
    // Mock render API dari fixture (Fase 1). Set NUXT_RENDER_MOCK=false saat
    // backend render API (NestJS /v1/render/*) sudah tersedia.
    renderMock: true,
    // Base URL backend NestJS termasuk prefix versi, mis. http://localhost:4000/v1
    renderApiBase: "",
    // Shared secret server-to-server (header X-Service-Token) — via env, jangan commit.
    renderServiceToken: "",

    public: {
      // Domain platform. Produksi: marketindonesia.co.id (NUXT_PUBLIC_BASE_DOMAIN).
      // Dev memakai lvh.me (wildcard DNS ke 127.0.0.1) — lihat README.
      baseDomain: "lvh.me",
    },
  },
});
