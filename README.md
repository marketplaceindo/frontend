# marketindonesia-frontend

Nuxt 4 SSR (situs publik tenant) + dashboard. Planning lengkap: [docs/PLAN-FRONTEND.md](docs/PLAN-FRONTEND.md).

## Prasyarat: token GitHub Packages (Fase 0)

Schema/DTO API diimpor dari package privat `@marketplaceindo/shared` yang di-host di GitHub Packages. Registry ini **selalu butuh autentikasi**, bahkan untuk read.

1. Buat Personal Access Token (classic) di <https://github.com/settings/tokens> dengan scope **`read:packages`** (akun harus punya akses ke org `marketplaceindo`).
2. Set sebagai environment variable — **jangan pernah menaruh token di `.npmrc` atau meng-commit-nya**:

   ```powershell
   # PowerShell (persisten untuk user; buka ulang terminal setelahnya)
   setx GITHUB_TOKEN "ghp_xxxx"
   ```

3. `npm install`

`.npmrc` repo ini me-resolve scope `@marketplaceindo` ke `https://npm.pkg.github.com` dengan token dari `${GITHUB_TOKEN}`. Bila token tidak tersedia/salah, install gagal dengan `npm error 401 Unauthorized - GET https://npm.pkg.github.com/@marketplaceindo%2fshared`; bila token ada tapi scope kurang, `403 ... does not match expected scopes` → cek kembali langkah 1–2.

## Aturan versi shared

- `@marketplaceindo/shared` dipasang dengan **versi pasti** (tanpa `^`/`~`). Upgrade selalu eksplisit: baca CHANGELOG rilisnya, bump versi, sesuaikan kode, typecheck + test hijau.
- **DILARANG mendefinisikan ulang schema/DTO API di repo ini.** Semua bentuk data API (block, section, theme, collection, request/response, konstanta) diimpor dari `@marketplaceindo/shared`. Butuh perubahan bentuk data? Berhenti — perubahan dilakukan di repo shared (lihat `docs/PLAN-SHARED.md` di repo shared), bukan di sini.
- Catatan penamaan: schema runtime memakai suffix `Schema` (mis. `blockSchema.safeParse(...)`), sedangkan `Block` adalah tipe hasil `z.infer`.

## Menjalankan (Fase 1)

```bash
npm run dev
```

Dev memakai **`lvh.me`** (DNS publik yang selalu me-resolve ke `127.0.0.1`, butuh internet; alternatif offline: `*.localhost`):

| URL | Mode |
|---|---|
| `http://localhost:3000` / `http://lvh.me:3000` / `http://app.lvh.me:3000` | Dashboard (placeholder, dibangun Fase 7) |
| `http://demo.lvh.me:3000` | Tenant fixture `demo` (kuliner, active) |
| `http://otojaya.lvh.me:3000` | Tenant fixture `otojaya` (otomotif, active) |
| `http://lengkap.lvh.me:3000` | Showcase 12 section inti dalam satu halaman (DoD Fase 3) |
| `http://rintisan.lvh.me:3000/?preview=1` | Tenant `draft` — tanpa `?preview=1` → 404; preview selalu noindex |
| `http://tutupsementara.lvh.me:3000` | Tenant `suspended` → 410 |

Data situs tenant datang dari **mock render API** (`server/mock/` — fixture JSON tervalidasi schema shared, semantik kontrak §10). Saat backend siap, set `NUXT_RENDER_MOCK=false` + `NUXT_RENDER_API_BASE` + `NUXT_RENDER_SERVICE_TOKEN` (server-to-server, header `X-Service-Token`); `server/utils/render-client.ts` beralih otomatis tanpa perubahan kode.

Resolusi tenant: `server/plugins/tenant.ts` membaca Host per request → `event.context.tenant` (`app`/`www`/apex → dashboard; subdomain lain → tenant). Catatan: `SUBDOMAIN_BLACKLIST` shared adalah aturan registrasi, bukan routing — subdomain seed platform (mis. `demo`) tetap di-serve sebagai tenant.

## Theming (Fase 2)

Design token = CSS custom properties (`--color-primary`, `--color-bg`, `--font-heading`, dst) dengan cascade 3 level:

1. **Level 1** — seed default di `app/assets/css/main.css` (`@theme` Tailwind 4; utility spt `bg-primary` resolve via `var()` sehingga ikut cascade).
2. **Level 2** — `tenant.themeJson` → `themeToVars()` → inline style root `.tenant-shell` di `layouts/tenant.vue` (ter-render di HTML SSR → tanpa FOUC).
3. **Level 3** — `section.styleJson` → `sectionStyleToCss()` → inline style wrapper `.section-shell` per section (menang karena var terdekat).

Konversi ada di `app/utils/theme-vars.ts` (murni, teruji); `app/composables/useTheme.ts` wiring reaktif + font loading dinamis via `useHead` (hanya family yang dipakai tenant, preconnect + `display=swap`, stylesheet non-blocking). Semua nilai divalidasi ulang dengan `tenantThemeSchema`/`sectionStyleSchema` sebelum render — nilai invalid dibuang (guard injection CSS).

## Block renderer (Fase 3)

`app/utils/block-map.ts` memetakan `block.type` → komponen (`app/components/blocks/*.vue`); `SectionRenderer.vue` iterasi sections sesuai `order` dan me-render tiap block. 12 section inti terpasang: navbar, hero, about, features, gallery, testimonials, stats, cta_band, faq, contact (+ embed Google Maps ter-guard), footer (badge "Dibuat dengan MarketIndonesia"), whatsapp_float. Tipe di luar itu (Fase 4: menu, vehicle_grid, dst) jatuh ke `BlockUnknown` — log di dev, render null (forward compatible; konten demo kuliner baru tampil penuh di Fase 4).

Aturan komponen block: props ter-type dari union `Block` shared (`Extract<Block, { type: "..." }>`), warna/font hanya dari token CSS var, mobile-first, gambar `loading="lazy"` + container aspect-ratio (hero eager sebagai kandidat LCP).

### Performa halaman publik

- Preload/prefetch chunk JS dimatikan via hook `build:manifest`; CSS global di-inline ke HTML SSR oleh `server/plugins/inline-css.ts` (produksi saja) — tidak ada request render-blocking.
- Font curated (Poppins, Inter, Plus Jakarta Sans) **di-self-host** (`public/fonts`, subset latin, `@font-face` inline, `display=swap`); family lain fallback otomatis ke Google Fonts non-blocking. Registry: `SELF_HOSTED_FONTS` di `app/utils/theme-vars.ts`.
- Lighthouse halaman fixture `lengkap` (semua 12 section): **mobile 99 / desktop 100** (throttling devtools). Catatan: mode default `simulate` menghasilkan ~85 di localhost karena artefak model — font same-origin selesai dimuat sebelum first paint teramati sehingga dihitung sebagai dependensi FCP; tidak terjadi pada deployment nyata.

## Perintah

```bash
npm run dev         # dev server (subdomain via lvh.me, lihat atas)
npm run typecheck   # nuxt typecheck (vue-tsc) + tsc project tests
npm test            # vitest — host parsing, fixture vs schema shared, akses per status
npm run build       # build produksi Nitro
```
