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

## Keputusan Vertikal: Sales Mobil (locked)

Keputusan berikut mengunci bentuk Fase 4–8 dan sudah terwujud di `@marketplaceindo/shared@1.0.0`.

### D-01 — Model konten bercabang: `VehicleModel` (mobil baru) vs `VehicleUnit` (mobil bekas)

Konsekuensi dari kebutuhan compare "Ultimate vs Exceed": keduanya bukan dua unit berbeda, melainkan *varian/trim dari satu model yang sama*. Satu record = satu unit fisik tidak bisa merepresentasikan ini tanpa duplikasi masif.

```
VehicleModel  (1) ──< VehicleVariant (n)     → dealer mobil BARU
VehicleUnit   (1 record = 1 unit fisik)      → showroom mobil BEKAS
```

- `VehicleModel` = Xpander. `VehicleVariant` = GLS / Exceed / Sport / Ultimate — masing-masing punya harga OTR, spesifikasi, dan warna sendiri.
- `VehicleUnit` = "Avanza 2019, 45.000 km" — dipertahankan, karena separuh pasar sales adalah mobil bekas.
- Tenant memilih **satu mode** saat onboarding (`settingsJson.salesMode`: `baru` | `bekas` | `keduanya`). Mode menentukan route, editor, dan block mana yang aktif.

### D-02 — Spesifikasi wajib berkunci kanonik (spec registry)

Compare tidak mungkin dibangun di atas tabel spesifikasi bebas (`{label, value}[]`): dua varian akan menulis "Kapasitas Mesin" vs "Isi Silinder" dan kolom tidak akan pernah sejajar. Semua spesifikasi yang dapat dibandingkan disimpan sebagai `Record<SpecKey, SpecValue>` dengan `SpecKey` dari registry tertutup `SPEC_REGISTRY` di shared (18 key awal, **append-only**). Field bebas tetap boleh ada di `specsCustom[]`, tapi **tidak ikut dibandingkan**.

### D-03 — Harga adalah OTR per kota, bukan angka tunggal

Harga mobil di Indonesia berbeda per kota (BBN berbeda per provinsi). Satu angka tanpa konteks kota membuat sales kehilangan kredibilitas di percakapan pertama. `priceOtr` adalah array `{cityCode, cityName, price, validUntil?}`. Kota default dari `tenant.settingsJson.defaultCity`. Selector kota bersifat global (Pinia store + cookie), memengaruhi harga di listing, VDP, compare, dan simulasi kredit sekaligus.

### D-04 — Halaman perbandingan adalah halaman SSR ber-URL, bukan modal

Alasannya bisnis, bukan teknis: **use case utamanya sales mengirim link perbandingan ke calon pembeli lewat WhatsApp.** Kalau compare hanya state di client, tidak ada yang bisa dikirim. URL shareable + OG image yang benar adalah fiturnya, bukan bonusnya.

### D-05 — Sales/Otomotif naik jadi template MVP

| Template | Sebelum | Sesudah |
|---|---|---|
| Sales/Otomotif | Fase produk 2 | **MVP** |
| Bisnis & Jasa | MVP | MVP (fallback, minimal) |
| Katalog Produk | MVP | Fase produk 2 |
| Kuliner | MVP | Fase produk 2 |

Konsekuensi yang diterima secara sadar: Fase 5 (collection) masuk jalur kritis MVP, dan Fase 4 untuk Kuliner/Katalog boleh di-stub. Ini menambah bobot MVP, tapi memusatkannya pada satu segmen yang bisa dijual.

---

## Fase 4 — Section Khas Template & Block Fungsional

Tahapan:
1. **Bisnis & Jasa**: layanan (services), proses/cara kerja, tim, logo klien/partner.
2. **Katalog Produk**: grid produk, kategori produk, daftar harga, banner promo. *(boleh di-stub untuk MVP — D-05)*
3. **Kuliner**: menu, menu andalan, jam buka & lokasi, reservasi/order online. *(boleh di-stub untuk MVP — D-05)*
4. **Sales/Otomotif** — section:
   - `model_grid` — grid model dengan filter (bodyType, rentang harga, transmisi, bahan bakar); kartu menampilkan harga **"mulai dari"** (varian termurah di kota aktif).
   - `variant_table` — tabel ringkas semua varian satu model (nama, harga, 3 highlight, CTA) — dipakai di halaman model.
   - `unit_grid` — grid mobil bekas (hanya aktif jika `salesMode` mencakup `bekas`).
   - `featured_vehicles`, `promo_banner` — reuse.
   - `city_selector` — selector kota global (bisa di navbar, bukan section penuh).
5. Block fungsional (spesifikasi detail di §"Spesifikasi Detail Fitur Otomotif"):
   - `simulasi_kredit` — kalkulator flat & efektif/anuitas. **Rumusnya diimpor dari shared (`hitungAngsuran`, `ringkasanKredit`), tidak ditulis ulang di komponen** — backend memakai fungsi yang sama untuk ringkasan WA.
   - `test_drive` — form lead → POST ke API leads; validasi client-side pakai schema shared via @vee-validate/zod.
   - `hubungi_sales` — deep link WhatsApp dengan pesan ter-prefill mereferensikan varian/unit.
   - `compare_tray` — bar melayang berisi item terpilih (global, mirip `whatsapp_float`).
6. Urutan default section per template di-drive dari `structure_json` (bukan hardcode di frontend).

Definition of done: template Sales/Otomotif ter-render lengkap dari fixture berisi ≥2 model × ≥3 varian; kalkulator kredit menghasilkan angka benar untuk metode flat & efektif (diverifikasi terhadap tabel uji di `kredit.test.ts` shared); form test drive tervalidasi dua arah; mengganti kota mengubah semua harga di halaman.

---

## Fase 5 — Collection: Listing & Detail Page (VDP/PDP)

Struktur route:

```
/mobil                                 → listing model (model_grid + filter)
/mobil/[model]                         → halaman model: hero, variant_table, compare antar varian
/mobil/[model]/[varian]                → VDP varian (halaman konversi utama)
/mobil-bekas                           → listing unit
/mobil-bekas/[slug]                    → VDP unit
/produk/[slug]                         → PDP produk (template katalog)
/bandingkan                            → halaman perbandingan (lihat Fase 5B)
```

Tahapan:
1. Filter lewat query param SSR (`?body=mpv&hargaMax=300000000`) agar crawlable dan shareable; pagination cursor.
2. `/mobil/[model]` memakai **default variant** (`isFeatured`, fallback `trimRank` tertinggi — helper `varianDefault()` di shared) untuk hero & harga, dengan variant switcher yang mengubah URL via `router.replace` — bukan state tersembunyi.
3. Redirect 301 dari `/mobil/[model]` ke varian **tidak dilakukan**; halaman model punya nilai SEO sendiri (query "harga xpander" jauh lebih besar dari "harga xpander ultimate").
4. State filter di server-side (SSR) supaya hasil filter tetap ter-index.

Definition of done: klik kartu model → halaman model SSR; klik varian → VDP dengan URL sendiri; simulasi kredit di VDP otomatis terisi harga OTR varian di kota aktif; filter menghasilkan URL unik yang bisa dibagikan.

---

## Fase 5B — Perbandingan Varian

Detail fungsional di §"Spesifikasi Detail Fitur Otomotif" · 4.

Tahapan:
1. **Store perbandingan** — `stores/compare.ts` (Pinia): `items: CompareRef[]` (`{modelSlug, variantSlug}`), maks **3** di mobile / **4** di desktop (`MAX_COMPARE_ITEMS*` dari shared), dipersist ke **cookie** (bukan localStorage — harus terbaca saat SSR).
2. **`compare_tray`** — bar melayang muncul saat `items.length > 0`; thumbnail + nama + tombol hapus + tombol "Bandingkan (n)". Di mobile duduk di atas `whatsapp_float`, jangan bertumpuk.
3. **Tombol "Bandingkan"** di kartu model, tabel varian, dan VDP — toggle, dengan state aktif yang jelas.
4. **Halaman `/bandingkan`** — SSR penuh dari query param `?v=xpander:ultimate,xpander:exceed`:
   - Parsing + validasi param memakai `parseCompareParam()` dari shared; item invalid diabaikan diam-diam, bukan error page.
   - Fetch data dari `GET /render/:subdomain/compare` (satu request, bukan N request).
   - Render tabel dari `specRows` yang disusun backend — frontend tidak menyusun matriks sendiri.
5. **Layout tabel mobile-first** (paling menentukan kualitas fitur ini):
   - Kolom pertama (label spesifikasi) `position: sticky; left: 0` dengan background solid.
   - Header varian (nama + harga + CTA) `position: sticky; top: 0`.
   - Horizontal scroll dengan `scroll-snap-type: x mandatory` per kolom.
   - Baris harga selalu di paling atas, tidak ikut collapse group.
6. **Toggle "Tampilkan perbedaan saja"** — sembunyikan baris `identical`. Default dari `defaultHanyaPerbedaan(n)`: aktif kalau ≥3 kolom, nonaktif kalau 2.
7. **Highlight pemenang** — pakai `SpecRow.winners` dari backend. Untuk `bool`, ✓/✗ dengan warna dari CSS var (jangan hardcode hijau/merah).
8. **Baris CTA di kaki tiap kolom** — "Tanya varian ini" (WA prefilled menyebut nama varian) + "Simulasi kredit" (buka drawer kalkulator dengan harga varian tersebut).
9. **Tombol "Kirim perbandingan ini via WhatsApp"** — copy URL kanonik + share via `wa.me`. Ini fitur untuk *sales*, bukan pembeli.
10. Handling `?v=` kosong → tampilkan variant picker, bukan halaman kosong.

Definition of done: membuka `/bandingkan?v=a:b,a:c` di tab baru (tanpa state client) menampilkan tabel lengkap ter-SSR; toggle "beda saja" menyembunyikan baris identik; tabel bisa dibaca dan di-scroll dengan satu ibu jari di viewport 360px; link yang di-share ke WhatsApp membuka halaman yang sama persis dengan preview OG yang benar.

---

## Fase 6 — SEO

Tahapan:
1. `useHead`/`useSeoMeta` per-tenant per-halaman dari `pages.seo_json` (title, description, OG image, canonical).
2. Sitemap.xml per-tenant (server route dinamis: baca daftar halaman + collection items tenant dari render API).
3. Robots.txt per-tenant (server route; blokir tenant `suspended`).
4. Structured data JSON-LD per tipe halaman:

| Halaman | Markup |
|---|---|
| Semua template | `LocalBusiness`/`Organization`; `FAQPage` untuk section FAQ |
| `/mobil/[model]` | `ProductGroup` dengan `hasVariant: Product[]`, `variesBy: ["https://schema.org/model"]`, `productGroupID` |
| `/mobil/[model]/[varian]` | `Product` (+`Car`) dengan `offers`, `inProductGroupWithID`, `vehicleConfiguration` |
| `/mobil-bekas/[slug]` | `Car`/`Vehicle` lengkap (`mileageFromOdometer`, `vehicleTransmission`, dst) — jalur Google Vehicle Listings |
| `/produk/[slug]` | `Product` |
| Kuliner | `Restaurant` + `Menu` |
| `/bandingkan` | tidak ada product markup |

   Catatan implementasi:
   - `ProductGroup` + `hasVariant` + `variesBy` + `productGroupID` adalah mekanisme resmi Google untuk mengelompokkan varian; setiap varian butuh ID unik dan tiap varian yang punya URL sendiri harus tetap membawa markup `Product` lengkap. Verifikasi tiap tipe lewat Rich Results Test — dokumentasi Google berubah, jangan percaya contoh di dokumen ini tanpa validasi.
   - **Kebijakan indeks `/bandingkan`:** kombinasi varian tumbuh kombinatorial dan isinya tipis → default `noindex, follow`. Hanya kombinasi dengan `curated: true` dari render API (`settingsJson.curatedComparisons[]`) yang di-`index`, dengan URL kanonik = `canonicalV` (slug terurut alfabetis, supaya `a,b` dan `b,a` tidak jadi dua halaman).
   - OG image dinamis untuk `/bandingkan` (Nitro route + satori/resvg): nama varian + harga berdampingan. Ini yang muncul saat sales share ke WA — bobotnya besar untuk konversi.
   - Sitemap per-tenant harus mencakup `/mobil/[model]` **dan** semua `/mobil/[model]/[varian]`.
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
4. Editor collection:
   - **Editor model** — form `VehicleModel`, upload multi-gambar dengan reorder.
   - **Editor varian bersarang** — daftar varian di dalam model, dengan:
     - **Duplikat varian** (wajib ada). Alur nyata: sales isi Exceed lengkap, lalu duplikat → ubah nama, harga, dan 5 spec yang beda. Tanpa ini, mengisi 4 varian butuh 20 menit dan user menyerah.
     - Form spec ter-generate dari `SPEC_REGISTRY` (helper `specsByGroup()`), dikelompokkan per `group`, input sesuai `valueType` (number+unit, toggle, select).
     - Indikator "belum diisi di varian ini tapi terisi di varian lain" — mencegah tabel compare bolong.
   - **Editor harga OTR** — tabel kota × harga, dengan aksi "terapkan selisih ke semua kota".
   - **Preview compare** dari dalam editor.
   - **Editor unit bekas & produk** — CRUD `VehicleUnit`/`Product`, daftar + pencarian.
   - *(Backlog, jangan blokir MVP)* Import CSV/paste tabel spesifikasi dari brosur → mapping ke spec key. Nilai tinggi untuk onboarding.
5. Panel theme: pemilih warna + font global (Level 2) dan per-section (Level 3), live preview.
6. Preview mode: iframe ke subdomain dengan query `?preview=1` (render draft, noindex).
7. Tombol Publish → panggil API publish → tampilkan status.
8. Pengaturan otomotif: `salesMode`, daftar kota + kota default, kombinasi perbandingan terkurasi (`PATCH /tenants/:id/settings`).

### 7d — Billing UI
1. Halaman status langganan (plan, periode, riwayat invoice); presentasi plan selalu menonjolkan **tahunan sebagai hero** (setara 10 bulan, hemat 17%).
2. Alur perpanjangan/upgrade (bulanan → tahunan sebagai jalur upsell utama); banner peringatan saat mendekati jatuh tempo / status `past_due` — selaras dengan reminder WA dari backend.
3. Batasan metode bayar per plan mengikuti backend: bulanan = QRIS/e-wallet; tahunan = semua kanal.

Definition of done: user baru mencapai preview situs terisi konten < 5 menit dari registrasi (diuji di HP); alur penuh daftar → wizard → preview → bayar → publish berjalan tanpa sentuhan manual; dari dashboard mobile (viewport 360px) user bisa membuat 1 model dengan 3 varian dalam < 10 menit memakai fitur duplikat varian.

---

## Fase 8 — ISR, Performa & Hardening

Tahapan:
1. `routeRules` ISR untuk halaman publik tenant (mis. `swr: 300`); `/mobil/**` → `swr: 300`; **`/bandingkan` tanpa cache** (kombinasi tak terbatas, cache tidak akan pernah hit dan hanya memakan storage); halaman dashboard tanpa cache.
2. Endpoint internal revalidate: dipanggil backend saat publish/update → purge cache halaman tenant terkait.
3. Optimasi gambar (Nuxt Image / CDN transform), audit bundle size, code-split editor dari renderer publik. Kalkulator kredit dan tabel compare masuk chunk terpisah (`defineAsyncComponent`) — jangan bebani first load VDP.
   Anggaran performa VDP: LCP < 2,5s di koneksi 4G teremulasi. Gambar hero varian pakai `fetchpriority="high"` + `<link rel=preload>`, sisanya lazy.
4. Error tracking (Sentry) + halaman error branded.
5. QA lintas template × device; uji tenant isolation dari sisi UI (tenant A tidak pernah melihat data tenant B).

Definition of done: TTFB halaman ter-cache < 200ms; perubahan konten muncul di situs publik ≤ interval ISR atau seketika setelah publish (via revalidate).

---

## Urutan pengerjaan & dependensi ke backend

```
Fase 0 (prasyarat: @marketplaceindo/shared v1.0.0 ter-publish — lihat PLAN-SHARED.md)
  → Fase 1–4 bisa jalan penuh dengan MOCK render API
  → Fase 5–5B–6 butuh render API otomotif nyata (/render/:subdomain/models, /variants, /compare)
  → Fase 7 butuh Auth, Tenants, Content, Billing API (Backend Fase 2–7)
  → Fase 8 butuh endpoint revalidate + webhook publish (Backend Fase 8)
```

Strategi: kerjakan Fase 1–4 paralel dengan backend memakai fixture (≥2 model × ≥3 varian); integrasi dimulai saat backend menyelesaikan render API otomotif.

Urutan lintas repo untuk perubahan vertikal otomotif:

```
1. [shared]   spec registry + VehicleModel/Variant + config block + LeadPayload + hitungAngsuran   ✅ v1.0.0
2. [backend]  endpoint /render/{models,variants,compare} + POST /leads + notifikasi WA ke sales
3. [frontend] Fase 4 → Fase 5 → Fase 5B → Fase 6 → Fase 7c → Fase 8
```

## Pemetaan ke milestone produk

Direvisi oleh D-05 — Sales/Otomotif naik ke MVP, Kuliner & Katalog turun.

- **MVP (Fase produk 1)**: Fase 0–3, **4–5 untuk template Sales/Otomotif**, **5B (compare)**, 6 (dasar + JSON-LD otomotif), 7a–7c (wizard + paywall di publish + editor model/varian), 8 (dasar). Template Bisnis & Jasa minimal sebagai fallback; Kuliner & Katalog boleh di-stub. Mobil bekas boleh menyusul setelah mobil baru.
- **Fase produk 2**: Fase 4–5 penuh untuk Kuliner & Katalog, 7d, editor matang (import CSV spesifikasi), dashboard statistik "hasil nyata" (klik WA, lead masuk, impresi Google — bukti nilai bulanan sebagai senjata retensi), generator copy LLM di wizard, UI reseller (satu akun mengelola banyak tenant).
- **Fase produk 3**: custom domain UI, analytics per-tenant lanjutan, tier premium.

---

## Spesifikasi Detail Fitur Otomotif

### 1. VDP Varian (`/mobil/[model]/[varian]`)

Urutan section default (di-drive dari `structure_json`, bukan hardcode):

1. Breadcrumb (`Beranda › Mobil › Xpander › Ultimate`) + BreadcrumbList JSON-LD
2. Galeri (swipeable, thumbnail, zoom) + badge stok
3. Judul + harga OTR kota aktif + selector kota inline + status stok
4. **Baris CTA sticky di mobile**: `Chat Sales` · `Test Drive` · `Simulasi Kredit` — selalu terlihat saat scroll. Ini elemen konversi tunggal paling penting di halaman.
5. Highlights (maks 6 poin pembeda varian)
6. Selector warna (swatch + ganti gambar hero + selisih harga)
7. Tabel spesifikasi (accordion per group, `specsCustom` di grup terakhir)
8. **Blok "Bandingkan dengan varian lain"** — chip varian lain dari model yang sama (`siblings` dari render API), satu tap → `/bandingkan` terisi otomatis
9. Simulasi kredit (harga prefilled)
10. Test drive
11. FAQ + footer

### 2. Simulasi Kredit

**Input:** harga OTR (prefilled, editable) · DP (slider % ⇄ input Rp, tersinkron lewat `dpDariPersen`/`persenDariDp`) · tenor (chip) · bunga/tahun · tipe asuransi.

**Output:** angsuran/bulan (angka besar), total dana awal yang harus disiapkan (DP + asuransi tahun 1 + admin + provisi + fidusia), pokok utang, total bayar, dan **perbandingan flat vs efektif berdampingan** ketika `tampilkanKeduaMetode`.

Rumus ada di `@marketplaceindo/shared` sebagai fungsi murni (`hitungAngsuran`, `ringkasanKredit`) — **jangan tulis ulang di komponen**; backend memakai fungsi yang sama untuk mengirim ringkasan via WA.

Aturan yang tidak boleh dilanggar:
- **Selalu tampilkan label metode.** Bunga flat 5% ≈ efektif 9–10%. Menampilkan angka flat tanpa label adalah cara tercepat kehilangan kepercayaan pembeli yang sudah membandingkan dengan leasing.
- Disclaimer wajib tampil, tidak bisa dinonaktifkan tenant (schema `simulasi_kredit` mewajibkan field `disclaimer`): angka adalah simulasi, belum termasuk biaya yang bisa berbeda per leasing, dan persetujuan kredit ada di pihak leasing.
- Semua perhitungan **client-side**, tanpa network call — harus responsif seketika saat slider digeser.
- Format Rupiah: `Intl.NumberFormat('id-ID')`, tanpa desimal, dibulatkan ke ribuan terdekat saat **ditampilkan** (fungsi shared tetap mengembalikan rupiah utuh — pembulatan adalah keputusan presentasi, jangan dibawa ke perhitungan).
- **CTA penutup: "Kirim simulasi ini ke sales"** — `wa.me` dengan pesan ter-prefill berisi ringkasan (unit, DP, tenor, angsuran). Ini momen konversi paling tinggi di seluruh situs — pembeli yang sudah menghitung angsuran adalah pembeli yang serius. Kirim juga `POST /leads` dengan `source: 'simulasi_kredit'` dan hasil hitungan di `meta` sebelum membuka WA (fire-and-forget, jangan blokir navigasi).

### 3. Test Drive

- Field: nama, no HP, tanggal (min `H+minLeadTimeHari`, blokir tanggal lampau), slot waktu, lokasi (select dari `lokasiOptions` + opsi "di alamat saya" dengan textarea), catatan opsional. Unit terisi otomatis dan **ditampilkan sebagai read-only chip**, bukan select — pembeli sudah memilih dengan sampai ke halaman ini.
- Validasi client memakai schema `leadPayloadSchema` yang sama dengan backend (via `@vee-validate/zod`) — satu sumber kebenaran.
- Nomor HP: normalisasi `08xx` → `628xx` sebelum submit memakai `normalisasiTelepon()` dari shared.
- Anti-spam: honeypot field tersembunyi (`hp`) + `submit` di-disable < 3 detik setelah mount + rate limit di backend.
- Sukses → tampilkan `pesanSukses` **plus tombol "Konfirmasi via WhatsApp"** (pakai `waDeepLink` dari response). Jangan berhenti di "terima kasih": pembeli UMKM Indonesia lebih percaya percakapan WA daripada form yang menghilang.
- Gagal (network/5xx) → jangan buang input; tampilkan tombol WA fallback dengan seluruh isi form sudah tersusun sebagai pesan (`fallbackWhatsApp`).
- Setelah sukses, simpan nama & no HP di cookie untuk prefill form berikutnya di sesi yang sama.

### 4. Perbandingan

**Kontrak URL:**
```
/bandingkan?v=xpander:ultimate,xpander:exceed
/bandingkan?v=xpander:ultimate,xforce:ultimate     // lintas model, valid
```
Kanonik = daftar `v` yang diurutkan (`canonicalV` dari render API). Maks 4 item; kelebihan dipotong dari kanan.

**Aturan render nilai:**

| `valueType` | Ada nilai | Tidak ada nilai (`null`) |
|---|---|---|
| `number` | `1.499 cc` (format id-ID + unit) | `—` |
| `bool` | ✓ / ✗ | `—` (jangan render ✗; "tidak diisi" ≠ "tidak ada") |
| `text`/`enum` | teks apa adanya | `—` |

Perbedaan antara "tidak punya fitur" dan "sales belum mengisi data" harus terlihat berbeda, kalau tidak tabel compare-nya menyesatkan dan sales akan berhenti memakainya.

**Yang sengaja TIDAK dibangun di v1:** compare lintas merek dengan data pihak ketiga (butuh basis data spesifikasi eksternal — masalah konten, bukan masalah kode), dan export PDF (share URL sudah menyelesaikan 90% kebutuhan).

### 5. Risiko yang perlu disadari

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Beban pengisian data varian terlalu berat | User menyerah di onboarding, funnel "coba dulu" gagal | Fitur duplikat varian (wajib), seed data per model populer, semua spec opsional kecuali harga |
| `SPEC_REGISTRY` terlalu kecil / terlalu besar | Terlalu kecil = compare tidak berguna; terlalu besar = form mengintimidasi | Mulai dari 18 key; append-only; tambah berdasarkan permintaan nyata |
| Halaman compare menghasilkan thin content | Risiko kualitas indeks di Search Console | Default `noindex, follow`; hanya kombinasi kurasi yang di-index |
| MVP membengkak karena Fase 5 masuk jalur kritis | Rilis mundur | Stub template Kuliner & Katalog (D-05); mobil bekas menyusul setelah mobil baru |
