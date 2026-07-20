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
| `http://demo.lvh.me:3000` | Template **kuliner** (menu, menu andalan, jam buka, reservasi) |
| `http://otojaya.lvh.me:3000` | Template **otomotif** (vehicle grid + koleksi, unit pilihan, simulasi kredit, form test drive, hubungi sales) |
| `http://tokoberkah.lvh.me:3000` | Template **katalog** (grid produk + koleksi, kategori, daftar harga, promo banner) |
| `http://lengkap.lvh.me:3000` | Template **bisnis & jasa** + showcase 12 section inti (layanan, proses, tim, logo klien) |
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

## Section khas template & block fungsional (Fase 4)

Seluruh 29 tipe block shared kini punya komponen. Catatan implementasi:

- **Koleksi**: `vehicle_grid`/`product_grid`/`featured_vehicles` fetch via `/api/_render/vehicles|products` (filter kontrak §7; subdomain selalu dari Host). Kontrak §7 tidak punya param `sort` — opsi sort block diterapkan pada slice yang terambil. Kartu unit ber-CTA deep link WA ter-prefill nama unit (Fase 5 menggantinya dengan link VDP).
- **`simulasi_kredit`**: logika flat & efektif/anuitas di `app/utils/kredit.ts` (teruji unit, dibulatkan ke rupiah), konfigurasi (bunga default, tenor, DP min) dari `data` block; menampilkan metode + disclaimer biaya tambahan.
- **`test_drive`**: form lead tervalidasi dua arah — client vee-validate + `leadPayloadSchema` shared (adapter Zod 4 lokal `app/utils/vv-zod.ts`, karena `@vee-validate/zod` masih terkunci peer zod v3), server `/api/leads` memvalidasi ulang `createLeadRequestSchema` → 422 `fieldErrors` dot-notation §1.4 → dipetakan balik ke field form. Lead diteruskan ke `/v1/public/:subdomain/leads` (mock: in-memory).
- Urutan section datang dari data render API (`order` — hasil materialisasi `structure_json` backend), tidak pernah di-hardcode di frontend.

## Listing & detail collection (Fase 5)

- **Listing** `/mobil` dan `/produk` (template halaman tetap, bukan section): filter via query params (`?brand=&priceMin=&priceMax=&year=&transmission=` / `?q=&category=&priceMin=&priceMax=`) — form GET native sehingga tiap kombinasi filter menghasilkan URL unik yang shareable & crawlable, hasil di-render SSR. Pagination cursor diteruskan lewat `?cursor=`.
- **Detail** `/mobil/[slug]` (VDP) dan `/produk/[slug]` (PDP): data dari `/api/_render/vehicles|products/[slug]` (kontrak §10 item), SSR dengan URL sendiri; VDP memuat tabel spesifikasi, deskripsi, CTA hubungi sales (WA ter-prefill nama unit), form test drive ber-`sourceItemSlug`, dan **simulasi kredit otomatis terisi harga unit** (`hargaAwal`). Galeri masih placeholder — resolusi `mediaId → URL` menunggu backend media (Fase 7).
- Prefix path `mobil` dan `produk` menjadi **reserved** (halaman CMS tenant dengan slug sama akan terbayangi oleh route listing).
- Catatan kontrak: plan menyebut "harga + varian" di VDP, tetapi schema `Vehicle` shared tidak punya field varian — tidak diimplementasikan sampai ada keputusan perubahan schema shared.

## SEO (Fase 6)

- **Meta per-halaman** via `useTenantSeo` (`app/composables/useTenantSeo.ts`): title/description dari `seoJson`, canonical self-referencing (`origin + path`, **tanpa query** → varian filter listing terkonsolidasi ke URL dasar), Open Graph + Twitter card, robots `index/noindex`.
- **noindex** untuk: `?preview=1`, tenant non-`active` (draft/suspended), dan `seoJson.noindex` per halaman.
- **sitemap.xml** per-tenant (`server/routes/sitemap.xml.ts`): daftar URL dari render API (`/`, tiap halaman, `/mobil` + `/produk` beserta item VDP/PDP). Tenant draft/suspended → 404/410 (tidak ada sitemap non-publik).
- **robots.txt** per-tenant (`server/routes/robots.txt.ts`): active → `Allow: /` + baris `Sitemap:`; draft/suspended/tidak-ada dan host dashboard/`app.` → `Disallow: /`.
- **JSON-LD** (`app/utils/jsonld.ts`, fungsi murni + `serializeJsonLd` yang escape `<`): `LocalBusiness` (semua template) atau `Restaurant` + `hasMenu` (kuliner, saat halaman memuat block `menu`), `FAQPage` (halaman ber-block `faq`), `Car` di VDP (eligibility Google Vehicle Listings), `Product` di PDP. Hanya di-emit saat halaman indexable (bukan preview/non-active).
- Keterbatasan diketahui: render API tidak mengekspos nama bisnis khusus → `businessName()` menurunkannya dari `seoJson.title` (bagian sebelum `—`/`|`), fallback subdomain. Bila nanti butuh presisi, tambahkan field di schema shared (perubahan kontrak, perlu keputusan).

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
