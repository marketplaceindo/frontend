# Planning Frontend — Platform Multi-Tenant Website Builder

Stack: **Nuxt 4 + Nitro (SSR/ISR)** · Vue 3 · Tailwind · Zod 4 via `@marketplaceindo/shared` (repo terpisah)

Scope frontend mencakup dua "aplikasi" dalam satu codebase Nuxt:
1. **Situs publik tenant** — di-render per subdomain (`[user].marketindonesia.co.id`), SSR + ISR, SEO-first.
2. **Dashboard** — onboarding, editor konten, pengaturan theme, billing (di domain utama / `app.marketindonesia.co.id`).

---

## Fase 0 — Prasyarat: Konsumsi Shared Package

Schema Zod TIDAK didefinisikan di repo ini. Sumber kebenarannya adalah package `@marketplaceindo/shared` dari repo terpisah (lihat `PLAN-SHARED.md`) yang di-publish ke GitHub Packages. Fase ini baru bisa dimulai setelah shared **v0.1.0 ter-publish**.

Tahapan:
1. Konfigurasi `.npmrc` untuk registry GitHub Packages (scope `@marketplaceindo`) + token read via env (jangan commit token).
2. Install `@marketplaceindo/shared` dengan **versi pasti** (tanpa `^`/`~`) — upgrade selalu eksplisit dan sadar.
3. Konfigurasi TypeScript 5.5+ strict mode (wajib untuk Zod 4).
4. Aturan repo: DILARANG mendefinisikan ulang schema/DTO API di repo ini — semua bentuk data API diimpor dari `@marketplaceindo/shared`.

Definition of done: `import { Block } from '@marketplaceindo/shared'` jalan; `Block.safeParse()` menolak payload invalid; build gagal dengan pesan jelas bila token registry tidak tersedia.

---

## Fase 1 — Fondasi Nuxt & Tenant Resolution

Tahapan:
1. Scaffold Nuxt 4, struktur folder sesuai desain:
   - `server/plugins/tenant.ts` — baca header `Host`, ekstrak subdomain, set `event.context.tenantId`.
   - `server/utils/renderClient.ts` — wrapper `$fetch` ke backend `/render/*` (base URL via runtime config).
   - `layouts/tenant.vue` dan `layouts/dashboard.vue`.
   - `pages/[...slug].vue` — catch-all untuk halaman tenant.
2. Logika pemisahan mode: request ke `app.` / domain utama → dashboard; subdomain lain → mode tenant.
3. Handling tenant tidak ditemukan / status `suspended` → halaman 404/410 khusus; status `draft` → situs publik tidak di-serve (404) KECUALI mode preview (`?preview=1` + sesi owner), selalu noindex.
4. Setup dev environment untuk subdomain lokal (`*.localhost` atau entri `/etc/hosts` + `lvh.me`).
5. Mock render API (fixture JSON) supaya frontend bisa jalan sebelum backend siap — fixture divalidasi dengan schema shared.

Definition of done: `demo.lvh.me:3000` me-render halaman dari fixture; subdomain berbeda menghasilkan konten berbeda.

---

## Fase 2 — Sistem Theming (CSS Variable Cascade)

Tahapan:
1. Definisikan design tokens sebagai CSS custom properties (`--color-primary`, `--color-bg`, `--font-heading`, `--font-body`, dst) dan wire ke Tailwind config.
2. `composables/useTheme.ts` — fungsi `toVars()` (theme/style JSON → objek CSS vars) + resolusi cascade 3 level:
   - Level 1: default template (seed).
   - Level 2: `tenant.theme_json` → di-apply di `layouts/tenant.vue` (root wrapper).
   - Level 3: `section.style_json` → inline style scoped di wrapper tiap section.
3. Font loading dinamis per-tenant via `useHead` — hanya load font yang dipakai tenant (Google Fonts subset atau self-host), preconnect + `font-display: swap`.
4. Validasi nilai style dengan `SectionStyle` schema sebelum render (guard terhadap injection ke CSS).

Definition of done: mengubah `theme_json` fixture mengubah tampilan tanpa rebuild; override section menang atas global; tidak ada FOUC/flash karena vars ter-render di HTML SSR.

---

## Fase 3 — Block Renderer & Section Inti

Tahapan:
1. Bangun `blockMap` (type → komponen Vue, global registration) + komponen `SectionRenderer` yang iterasi sections/blocks sesuai `order`.
2. Implement 12 section inti (dipakai semua template):
   navbar/header, hero, tentang/cerita, keunggulan (benefits), galeri, testimoni, statistik/counter, CTA band, FAQ, kontak + embed Google Maps, footer (memuat badge "Dibuat dengan [brand]" + backlink pada plan dasar — viral loop akuisisi), WhatsApp mengambang (floating, global).
3. Tiap komponen block: props ter-type dari `z.infer`, konsumsi CSS vars (tidak hardcode warna/font), responsive mobile-first, lazy-load gambar (`loading="lazy"`, ukuran eksplisit untuk cegah CLS).
4. Komponen fallback untuk `type` tak dikenal (log + render null) — jaga forward compatibility.

Definition of done: satu halaman fixture berisi semua 12 section ter-render benar di mobile & desktop; Lighthouse performa > 90 pada halaman fixture.

---

## Fase 4 — Section Khas Template & Block Fungsional

Tahapan:
1. **Bisnis & Jasa**: layanan (services), proses/cara kerja, tim, logo klien/partner.
2. **Katalog Produk**: grid produk, kategori produk, daftar harga, banner promo.
3. **Kuliner**: menu, menu andalan, jam buka & lokasi, reservasi/order online.
4. **Sales/Otomotif**: vehicle grid (dengan filter), featured vehicles, promo banner (reuse).
5. Block fungsional:
   - `simulasi_kredit` — kalkulator flat & efektif/anuitas (logika di komponen, konfigurasi dari `data`); tampilkan metode yang dipakai + disclaimer biaya tambahan (asuransi, admin, provisi, fidusia).
   - `test_drive` — form lead (nama, no HP, tanggal, unit) → POST ke API leads; validasi client-side pakai schema shared via @vee-validate/zod.
   - `hubungi_sales` — deep link WhatsApp dengan pesan ter-prefill mereferensikan unit/produk.
6. Urutan default section per template di-drive dari `structure_json` (bukan hardcode di frontend).

Definition of done: keempat template ter-render lengkap dari fixture; kalkulator kredit menghasilkan angka benar untuk kedua metode; form test drive tervalidasi dua arah.

---

## Fase 5 — Collection: Listing & Detail Page (VDP/PDP)

Tahapan:
1. Route dinamis detail: `/mobil/[slug]` (Vehicle) dan `/produk/[slug]` (Product) — data dari render API collection item.
2. Halaman detail sebagai *template halaman* (layout tetap): galeri foto, tabel spesifikasi, harga + varian, CTA (hubungi sales / test drive / simulasi kredit ter-prefill harga unit).
3. Listing page: grid + filter (merk, harga, tahun, transmisi / kategori) — filter via query params supaya URL shareable & crawlable; pagination.
4. State filter di server-side (SSR) supaya hasil filter tetap ter-index.

Definition of done: klik item di grid → halaman detail SSR dengan URL sendiri; filter menghasilkan URL unik yang bisa dibagikan; simulasi kredit di VDP otomatis terisi harga unit.

---

## Fase 6 — SEO

Tahapan:
1. `useHead`/`useSeoMeta` per-tenant per-halaman dari `pages.seo_json` (title, description, OG image, canonical).
2. Sitemap.xml per-tenant (server route dinamis: baca daftar halaman + collection items tenant dari render API).
3. Robots.txt per-tenant (server route; blokir tenant `suspended`).
4. Structured data JSON-LD: `LocalBusiness`/`Organization` (semua template), `Product` (katalog), `Vehicle`/`Product` di VDP (eligibility Google Vehicle Listings), `Restaurant` + `Menu` (kuliner), `FAQPage` untuk section FAQ.
5. Meta noindex untuk tenant yang belum publish.

Definition of done: validasi lewat Rich Results Test untuk tiap tipe schema; sitemap dua tenant berbeda berisi URL masing-masing.

---

## Fase 7 — Dashboard: Onboarding & Editor

Fase terbesar. Pecah jadi sub-fase:

### 7a — Auth & shell dashboard
1. Halaman login/register, penyimpanan token (httpOnly cookie via Nitro proxy — hindari localStorage untuk token).
2. Layout dashboard + navigasi + guard route.

### 7b — Onboarding wizard (alur coba dulu → bayar saat publish)
Prinsip: **nilai dilihat dulu, dompet belakangan** — seluruh wizard berjalan TANPA pembayaran. Target: preview situs jadi < 5 menit dari registrasi, dari HP.
1. Daftar gratis (email/no HP) → langsung masuk wizard, tanpa pilih plan.
2. Wizard "bahasa manusia" (5–7 pertanyaan, bukan editor): nama usaha, jenis usaha (→ otomatis pilihkan template), alamat, nomor WA, jam buka, 3 produk/layanan andalan + foto.
3. Step input subdomain: cek ketersediaan real-time (debounced), tampilkan aturan format & kata terlarang, saran otomatis dari nama usaha.
4. Materialize situs **terisi konten nyata dari jawaban wizard** (bukan lorem ipsum) → langsung tampilkan preview penuh (subdomain + `?preview=1`, noindex).
5. Paywall di tombol Publish: pilih plan — **tahunan Rp300rb sebagai hero plan**, bulanan Rp30rb sekunder (metode bayar QRIS/e-wallet saja) → invoice Xendit → poll status → publish otomatis saat paid.
6. (Backlog fase produk 2) Generator copy hero/tentang-kami via LLM API dari jawaban wizard.

### 7c — Editor konten (slot editor)
Prinsip non-negotiable: **mobile-first** — mayoritas user mengelola situs dari HP Android, bukan laptop. Desain editor untuk layar sempit sejak awal (bukan responsive afterthought); perangkat uji utama = Android Chrome.
1. Daftar halaman + section per halaman (sesuai slot template), toggle aktif/nonaktif section, reorder (drag sederhana → update `order`).
2. Form editor per block — field di-generate/dipetakan dari schema Zod block; validasi live via @vee-validate/zod.
3. Upload gambar (ke endpoint upload backend / object storage), dengan resize preview.
4. Editor collection: CRUD Vehicle/Product (form dari schema `Vehicle`/`Product`), daftar + pencarian.
5. Panel theme: pemilih warna + font global (Level 2) dan per-section (Level 3), live preview.
6. Preview mode: iframe ke subdomain dengan query `?preview=1` (render draft, noindex).
7. Tombol Publish → panggil API publish → tampilkan status.

### 7d — Billing UI
1. Halaman status langganan (plan, periode, riwayat invoice); presentasi plan selalu menonjolkan **tahunan sebagai hero** (setara 10 bulan, hemat 17%).
2. Alur perpanjangan/upgrade (bulanan → tahunan sebagai jalur upsell utama); banner peringatan saat mendekati jatuh tempo / status `past_due` — selaras dengan reminder WA dari backend.
3. Batasan metode bayar per plan mengikuti backend: bulanan = QRIS/e-wallet; tahunan = semua kanal.

Definition of done: user baru mencapai preview situs terisi konten < 5 menit dari registrasi (diuji di HP); alur penuh daftar → wizard → preview → bayar → publish berjalan tanpa sentuhan manual.

---

## Fase 8 — ISR, Performa & Hardening

Tahapan:
1. `routeRules` ISR untuk halaman publik tenant (mis. `swr: 300`); halaman dashboard tanpa cache.
2. Endpoint internal revalidate: dipanggil backend saat publish/update → purge cache halaman tenant terkait.
3. Optimasi gambar (Nuxt Image / CDN transform), audit bundle size, code-split editor dari renderer publik.
4. Error tracking (Sentry) + halaman error branded.
5. QA lintas template × device; uji tenant isolation dari sisi UI (tenant A tidak pernah melihat data tenant B).

Definition of done: TTFB halaman ter-cache < 200ms; perubahan konten muncul di situs publik ≤ interval ISR atau seketika setelah publish (via revalidate).

---

## Urutan pengerjaan & dependensi ke backend

```
Fase 0 (prasyarat: @marketplaceindo/shared v0.1 ter-publish — lihat PLAN-SHARED.md)
  → Fase 1–4 bisa jalan penuh dengan MOCK render API
  → Fase 5–6 butuh render API collection nyata (Backend Fase 8)
  → Fase 7 butuh Auth, Tenants, Content, Billing API (Backend Fase 2–7)
  → Fase 8 butuh endpoint revalidate + webhook publish (Backend Fase 8)
```

Strategi: kerjakan Fase 1–4 paralel dengan backend memakai fixture; integrasi dimulai saat backend menyelesaikan render API read-only.

## Pemetaan ke milestone produk

- **MVP (Fase produk 1)**: Fase 0–3, 6 (dasar), 7a–7c minimal (1–2 template, wizard + paywall di publish), 8 (dasar).
- **Fase produk 2**: Fase 4–5 penuh (4 template + collection), 7d, editor matang, dashboard statistik "hasil nyata" (klik WA, lead masuk, impresi Google — bukti nilai bulanan sebagai senjata retensi), generator copy LLM di wizard, UI reseller (satu akun mengelola banyak tenant).
- **Fase produk 3**: custom domain UI, analytics per-tenant lanjutan, tier premium.
