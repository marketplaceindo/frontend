import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2026-07-15",
  devtools: { enabled: false },

  css: ["~/assets/css/main.css"],

  features: {
    // Inline CSS ke HTML SSR — menghapus request CSS render-blocking
    // (halaman publik tenant dinilai Lighthouse; lihat DoD Fase 3).
    inlineStyles: true,
  },

  hooks: {
    // Tanpa ini semua chunk JS di-<link modulepreload> berprioritas tinggi dan
    // berebut bandwidth dengan CSS/HTML sebelum first paint (FCP mobile jeblok).
    // Script entry tetap dimuat via <script type=module>; hydration hanya
    // bergeser sedikit — halaman publik tenant nyaris tanpa interaksi JS.
    "build:manifest"(manifest) {
      for (const item of Object.values(manifest)) {
        item.prefetch = false;
        item.preload = false;
      }
    },
  },

  typescript: {
    strict: true,
  },

  /**
   * Fase 8 — kebijakan cache.
   *
   * Catatan penting: mode dashboard dan situs tenant BERBAGI path (`/`,
   * `/<slug>`) dan hanya dibedakan Host, sedangkan routeRules berbasis path.
   * Karena itu HTML `/` sengaja TIDAK di-cache global — men-cache-nya berisiko
   * menyajikan dashboard milik satu user ke user lain. ISR-nya dipasang satu
   * lapis lebih dalam, di `/api/_render/*` (data tenant murni, kunci memuat
   * subdomain) — lihat server/utils/render-cache.ts.
   *
   * Path yang PASTI milik situs tenant tetap boleh di-cache di level HTML,
   * dengan `host` ikut jadi kunci agar tenant tidak saling tertukar.
   */
  routeRules: {
    "/mobil/**": { swr: 300, cache: { varies: ["host", "x-forwarded-host"] } },
    "/mobil-bekas/**": { swr: 300, cache: { varies: ["host", "x-forwarded-host"] } },
    "/produk/**": { swr: 300, cache: { varies: ["host", "x-forwarded-host"] } },

    /*
     * `/bandingkan` sengaja TANPA cache (addendum §Fase 8): kombinasi varian
     * tumbuh kombinatorial sehingga cache nyaris tak pernah hit dan hanya
     * memakan storage. Halamannya juga ringan — semua data datang dari satu
     * request `/render/compare`.
     */
    "/bandingkan": { cache: false },

    // Area dashboard: selalu personal, tidak boleh menyentuh cache mana pun.
    // (noindex-nya sudah di-set DashboardApp lewat useSeoMeta.)
    "/login": { cache: false },
    "/register": { cache: false },
    "/onboarding": { cache: false },
    "/editor": { cache: false },
    "/langganan": { cache: false },
    "/bayar-simulasi": { cache: false },
    "/api/tenants/**": { cache: false },
    "/api/pages/**": { cache: false },
    "/api/billing/**": { cache: false },
    "/api/auth/**": { cache: false },
  },

  vite: {
    plugins: [tailwindcss()],
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

    // Dashboard API (auth/tenants/content/billing). Mock in-memory (Fase 7a)
    // sampai backend NestJS siap; set NUXT_DASHBOARD_MOCK=false untuk proxy nyata.
    dashboardMock: true,
    // Base URL NestJS termasuk prefix versi, mis. http://localhost:4000/v1.
    dashboardApiBase: "",

    public: {
      // Domain platform. Produksi: marketindonesia.co.id (NUXT_PUBLIC_BASE_DOMAIN).
      // Dev memakai lvh.me (wildcard DNS ke 127.0.0.1) — lihat README.
      baseDomain: "lvh.me",
    },
  },
});
