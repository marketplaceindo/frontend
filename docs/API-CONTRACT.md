# Kontrak API — Platform Multi-Tenant Website Builder

Dokumen ini adalah **satu-satunya sumber kebenaran** untuk API antara backend (NestJS) dan frontend (Nuxt). Semua bentuk request/response merujuk ke schema Zod di package `@marketplaceindo/shared` (repo terpisah, GitHub Packages — lihat `PLAN-SHARED.md`) — jika dokumen ini dan schema shared berbeda, schema shared yang menang dan dokumen ini harus diperbarui.

Status: Draft v1 · Berlaku untuk prefix `/v1` · Selaras dengan `@marketplaceindo/shared@1.0.0`

---

## 1. Konvensi Umum

### 1.1 Base URL & topologi konsumsi

| Konsumen | Jalur | Keterangan |
|---|---|---|
| Dashboard (browser) | `https://app.marketindonesia.co.id/api/*` → proxy Nitro → NestJS `/v1/*` | Browser TIDAK pernah memanggil NestJS langsung; token disimpan httpOnly cookie, Nitro meneruskannya sebagai header `Authorization` |
| Situs publik tenant (SSR) | Nuxt server → NestJS `/v1/render/*` | Server-to-server, autentikasi `X-Service-Token` |
| Form publik (browser di situs tenant) | Browser → Nuxt route `/api/leads` → NestJS `/v1/public/*` | Browser tidak pernah menyentuh NestJS langsung |
| Xendit | → NestJS `/v1/webhooks/xendit` | Inbound webhook, verifikasi `x-callback-token` |
| NestJS → Nuxt | → Nuxt `/api/_internal/revalidate` | Purge cache ISR saat publish, autentikasi `X-Service-Token` |

### 1.2 Versioning
- Semua endpoint di bawah prefix `/v1`.
- Perubahan **additive** (field baru opsional, endpoint baru) tidak menaikkan versi.
- Perubahan **breaking** (hapus/rename field, ubah semantik) → `/v2`, `/v1` dipertahankan minimal selama masa transisi yang disepakati.

### 1.3 Format data
- JSON, `camelCase` di transport (mapping ke `snake_case` DB dilakukan di backend).
- ID: UUID v4 (string). Timestamp: ISO 8601 UTC (`2026-07-14T03:00:00Z`).
- Uang: integer Rupiah (tanpa desimal), mis. `300000`.
- Response sukses mengembalikan resource/objek langsung (tanpa envelope `data`).

### 1.4 Format error (seragam di semua endpoint)

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR",        // enum, lihat §10
    "message": "Data tidak valid",      // aman ditampilkan ke user (Bahasa Indonesia)
    "fieldErrors": {                    // opsional; hasil flatten ZodError
      "data.heading": ["Wajib diisi", "Maksimal 120 karakter"]
    },
    "details": {}                       // opsional; payload tambahan per-kode (mis. PAYWALL)
  }
}
```

- `fieldErrors` memakai path dot-notation sesuai schema Zod shared → frontend memetakan langsung ke field form (@vee-validate).
- Setiap response menyertakan header `X-Request-Id` (echo dari request bila ada, generate bila tidak) untuk korelasi log.

### 1.5 Autentikasi & otorisasi
- `Authorization: Bearer <accessToken>` — access token JWT umur pendek (15 menit).
- Refresh token: rotasi, disimpan hash di DB, dikirim/diterima hanya via endpoint refresh.
- Semua endpoint `tenants/:id/*` dan resource turunannya melewati `TenantOwnershipGuard` (`tenant.owner_id === user.id`). Pelanggaran → `403 FORBIDDEN` (bukan 404, kecuali resource memang tidak ada).
- Endpoint `/render/*`, `/public/*`, `/_internal/*` memakai `X-Service-Token` (shared secret antar-service), bukan JWT user.

### 1.6 Pagination (cursor-based)
- Request: `?limit=20&cursor=<opaque>` (limit default 20, maks 100).
- Response: `{ "items": [...], "nextCursor": "abc123" | null }`.

### 1.7 Idempotency
- Webhook Xendit: dedup berdasarkan ID invoice/event Xendit (unique constraint) — pengiriman ganda tidak berefek ganda.
- `POST /billing/subscribe` menerima header opsional `Idempotency-Key`; key sama dalam 24 jam → response tersimpan yang sama.

### 1.8 Rate limit
- Auth: ketat (mis. 5 percobaan login/menit/IP, lockout progresif).
- `/public/leads`: per-IP + per-tenant (mis. 5/menit/IP) + honeypot/Turnstile.
- Umum (dashboard): longgar, per-user. Response saat kena limit: `429 RATE_LIMITED` + header `Retry-After`.

---

## 2. Auth

### POST /v1/auth/register
Body: `{ "email": string, "password": string, "name": string, "whatsapp"?: string }`
→ `201 { "user": User, "accessToken": string, "refreshToken": string }`
Error: `409 EMAIL_TAKEN`, `422 VALIDATION_ERROR`

### POST /v1/auth/login
Body: `{ "email": string, "password": string }`
→ `200 { "user": User, "accessToken": string, "refreshToken": string }`
Error: `401 INVALID_CREDENTIALS`, `429 RATE_LIMITED`

### POST /v1/auth/refresh
Body: `{ "refreshToken": string }`
→ `200 { "accessToken": string, "refreshToken": string }` (token lama dicabut — rotasi)
Error: `401 INVALID_REFRESH_TOKEN`

Tipe `User`: `{ id, email, name, whatsapp?, createdAt }`

---

## 3. Tenants & Onboarding

Status tenant: `draft → active → suspended` (state machine; transisi hanya via service).

Tipe `Tenant`:
```jsonc
{
  "id": "uuid",
  "subdomain": "warungbudi",          // null bila belum dipilih
  "status": "draft",                   // draft | active | suspended
  "templateId": "uuid",               // null bila belum dipilih
  "themeJson": TenantTheme,            // schema shared
  "settingsJson": {                    // schema shared; {} untuk tenant non-otomotif
    "salesMode"?: "baru" | "bekas" | "keduanya",
    "defaultCity"?: "JKT",
    "cities": [{ "code": "JKT", "name": "Jakarta" }],
    "curatedComparisons": [{ "label": "Exceed vs Ultimate", "v": "xpander:exceed,xpander:ultimate" }]
  },
  "createdAt": "...", "publishedAt": null
}
```

### GET /v1/tenants/me
→ `200 { "items": Tenant[] }` — array (satu user bisa punya banyak tenant; fondasi program reseller).

### POST /v1/tenants
Membuat draft tenant kosong (dipanggil otomatis saat user memulai wizard).
→ `201 Tenant` · Error: `409 TENANT_LIMIT_REACHED` (batas draft per user, anti-abuse)

### POST /v1/tenants/check-subdomain
Body: `{ "subdomain": string }`
→ `200 { "available": boolean, "reason"?: "TAKEN" | "RESERVED" | "INVALID_FORMAT", "suggestions"?: string[] }`
Validasi: RFC 1035 (lowercase, alfanumerik + hyphen, ≤63 char), blacklist (`www`, `api`, `app`, `admin`, `mail`, ...). `suggestions` diisi bila tidak tersedia (derivasi dari input).

### PATCH /v1/tenants/:id/subdomain
Body: `{ "subdomain": string }` → `200 Tenant`
Error: `409 SUBDOMAIN_TAKEN`, `422 SUBDOMAIN_RESERVED | VALIDATION_ERROR`
Catatan: setelah `status=active`, perubahan subdomain dibatasi (kebijakan MVP: tidak boleh; → `409 SUBDOMAIN_LOCKED`).

### POST /v1/tenants/:id/wizard
Jalur onboarding utama. Body: `WizardAnswers` (schema shared):
```jsonc
{
  "businessName": "Warung Budi",
  "businessType": "kuliner",          // bisnis_jasa | katalog | kuliner | otomotif → menentukan template
  "address": "Jl. Melati 5, Jakarta",
  "whatsapp": "6281234567890",
  "openingHours"?: [{ "days": "Sen–Sab", "open": "08:00", "close": "21:00" }],
  "highlights": [                      // 1–3 produk/layanan/menu andalan
    { "name": "Nasi Goreng Spesial", "price"?: 25000, "mediaId"?: "uuid" }
  ],
  "tagline"?: "..."
}
```
→ `200 { "tenant": Tenant, "previewUrl": "https://warungbudi.marketindonesia.co.id/?preview=1" }`
Efek: pilih template dari `businessType`, **materialize pages/sections/blocks terisi konten nyata dari jawaban**. Idempotent: dipanggil ulang = re-materialize (dengan konfirmasi di frontend bila konten sudah diedit).
Error: `422 VALIDATION_ERROR`, `409 TENANT_ALREADY_ACTIVE`

### PATCH /v1/tenants/:id/template
Body: `{ "templateId": "uuid", "confirmReset": true }` → `200 Tenant`
Ganti template = reset konten (kebijakan MVP); `confirmReset` wajib `true` bila konten sudah ada → jika tidak, `409 CONFIRMATION_REQUIRED`.

### PATCH /v1/tenants/:id/theme
Body: `TenantTheme` (schema shared, validasi hex/enum) → `200 Tenant`

### PATCH /v1/tenants/:id/settings
Body: `TenantSettings` parsial (field yang dikirim saja yang di-merge) → `200 Tenant`
Dipakai untuk `salesMode`, daftar kota + kota default (harga OTR), dan kombinasi perbandingan yang dikurasi. Mengubah `curatedComparisons` memicu revalidate halaman `/bandingkan` terkait.
Error: `422 VALIDATION_ERROR` (mis. kombinasi `v` berisi < 2 varian valid)

### POST /v1/tenants/:id/publish
**Titik paywall.**
- Tanpa subscription aktif → `402 PAYWALL_REQUIRED`:
```jsonc
{ "error": { "code": "PAYWALL_REQUIRED", "message": "Pilih paket untuk menerbitkan situsmu",
  "details": { "plans": [
    { "id": "yearly",  "label": "Tahunan",  "price": 300000, "hero": true,  "channels": ["qris","ewallet","va","card"] },
    { "id": "monthly", "label": "Bulanan",  "price": 30000,  "hero": false, "channels": ["qris","ewallet"] }
  ] } } }
```
  → frontend menampilkan pilihan plan lalu memanggil `POST /billing/subscribe`.
- Dengan subscription aktif → validasi kelengkapan minimum (≥1 halaman, section wajib terisi) → `200 { "tenant": Tenant, "url": "https://warungbudi.marketindonesia.co.id" }` (+ trigger revalidate). Gagal validasi → `422 CONTENT_INCOMPLETE` dengan `details.missing[]`.

---

## 4. Templates (katalog publik)

### GET /v1/templates
→ `200 { "items": [{ "id", "slug", "name", "businessType", "previewImageUrl", "demoUrl" }] }`

### GET /v1/templates/:slug
→ `200 { ...ringkasan, "structureJson": TemplateStructure }` — dipakai editor untuk mengetahui slot & block yang diizinkan.

---

## 5. Content (Pages, Sections, Blocks)

Model draft vs published: endpoint modul ini selalu bekerja pada **draft**; situs publik membaca **snapshot** yang dibuat saat publish (lihat §9).

### GET /v1/tenants/:id/pages
→ `200 { "items": [{ "id", "slug", "title", "seoJson", "updatedAt" }] }`

### POST /v1/tenants/:id/pages
Body: `{ "slug": string, "title": string }` → `201 Page` · Error: `409 SLUG_TAKEN`, `409 PLAN_LIMIT_REACHED`

### PATCH /v1/pages/:pageId
Body: `{ "title"?, "seoJson"?: PageSeo }` → `200 Page`

### DELETE /v1/pages/:pageId → `204`

### GET /v1/pages/:pageId
→ `200 { "page": Page, "sections": [{ "id", "sectionKey", "order", "enabled", "styleJson": SectionStyle, "blocks": Block[] }] }` — payload penuh untuk editor.

### PATCH /v1/pages/:pageId/sections/:sectionId
Body: `{ "styleJson"?: SectionStyle, "order"?: number, "enabled"?: boolean }` → `200 Section`

### PUT /v1/pages/:pageId/sections/:sectionId/blocks
Bulk replace. Body: `{ "blocks": Block[] }` (tiap item divalidasi discriminated union `Block`; tipe block harus diizinkan oleh slot menurut `structureJson`).
→ `200 { "blocks": Block[] }` · Error: `422 VALIDATION_ERROR` (fieldErrors per-index: `blocks.0.data.heading`), `422 BLOCK_NOT_ALLOWED_IN_SLOT`

---

## 6. Media

### POST /v1/tenants/:id/media/presign
Body: `{ "filename": string, "mimeType": string, "size": number }`
→ `201 { "mediaId": "uuid", "uploadUrl": "https://...", "fileUrl": "https://cdn.../tenants/:id/..." }`
Klien meng-upload langsung ke `uploadUrl` (PUT). Batas: tipe MIME whitelist (jpeg/png/webp), ukuran maks per plan.
Error: `422 UNSUPPORTED_MEDIA_TYPE | FILE_TOO_LARGE`, `409 PLAN_LIMIT_REACHED` (kuota storage)

Setelah upload sukses, editor menyimpan `ImageRef` berisi **`mediaId` dan `url` (dari `fileUrl`) sekaligus** — `mediaId` untuk kuota/hapus/transformasi CDN, `url` supaya thumbnail langsung tampil tanpa request resolusi tambahan. `alt` diisi otomatis dari nama file dan tetap bisa diedit user.

---

## 7. Collections (Vehicle Models, Vehicle Units & Products)

Koleksi kendaraan bercabang dua sejak v1.0.0 (keputusan D-01, `PLAN-FRONTEND.md` §Otomotif):

```
VehicleModel (1) ──< VehicleVariant (n)     → dealer mobil/motor BARU
VehicleUnit  (1 record = 1 unit fisik)      → showroom mobil BEKAS
```

Tenant memilih mode saat onboarding (`settingsJson.salesMode`: `baru` | `bekas` | `keduanya`); mode menentukan route, editor, dan block yang aktif. Semua tipe mengikuti schema shared; masing-masing punya `slug` unik per tenant (auto-generate dari nama, bisa dioverride). Slug varian unik dalam satu model.

### 7.1 Vehicle Models (kendaraan baru — mobil & motor)

`VehicleVariant` memuat harga OTR **per kota** (`priceOtr[]`, keputusan D-03), warna, `specs` berkunci registry (§7.3), `specsCustom[]` bebas, `highlights[]`, `stockStatus`, `trimRank`, `isFeatured`.

Sejak v1.1.0 `VehicleModel` punya discriminator **`vertical`** (`mobil` | `motor`, default `mobil` — keputusan D-12). Motor baru memakai bentuk data yang identik; yang berbeda hanya `bodyType` dan `specs` yang berlaku:

| `vertical` | `bodyType` yang sah |
|---|---|
| `mobil` | `mpv` `suv` `sedan` `hatchback` `pickup` `lcgc` `van` `wagon` |
| `motor` | `matic` `bebek` `sport` `naked` `trail` `listrik` `moge` |

Kombinasi yang tidak konsisten ditolak schema dengan `422` — validasinya lintas-field di level model, bukan per-field.

`VehicleVariant` juga membawa field **provenance** (keputusan D-11, semua opsional): `catalogVariantId`, `priceSource` (`catalog` | `manual` | `excel`, default `manual`), `priceUpdatedAt`, `priceEstimated`, `priceEstimatedFromCity`. `VehicleModel` membawa `catalogModelId`. Field-field ini **murni metadata** — tidak satu pun memicu perilaku backend; keberadaannya untuk round-trip Excel (§7.6) dan badge provenance di editor.

`priceEstimated: true` berarti harga berasal dari fallback rantai kota (D-14) dan **wajib** dirender sebagai estimasi, bukan sebagai OTR pasti — lihat §10.

### GET /v1/tenants/:id/vehicle-models
Query: `?limit&cursor&q&city&brand&body&hargaMin&hargaMax&transmisi&bahanBakar&sort` → `200 { items, nextCursor }`

### POST /v1/tenants/:id/vehicle-models
Body: `VehicleModelInput` (model + minimal 1 varian) → `201 VehicleModel` · Error: `409 PLAN_LIMIT_REACHED`

### PATCH /v1/vehicle-models/:modelId → `200 VehicleModel`
### DELETE /v1/vehicle-models/:modelId → `204`

Kuota plan (`PLAN_LIMITS.maxCollectionItems`) dihitung **per model**, bukan per varian — satu model dengan 4 varian = 1 item.

### 7.2 Vehicle Units (mobil bekas)

`VehicleUnit` = schema `Vehicle` lama yang di-rename, ditambah field khas unit bekas: `plateCode` (kode wilayah saja, mis. `B` — nomor pelat lengkap TIDAK disimpan), `condition`, `ownerCount`, `taxValidUntil`. Harga tunggal (bukan OTR per kota).

### GET /v1/tenants/:id/vehicle-units
Query: `?limit&cursor&q&brand&priceMin&priceMax&year&transmission` → `200 { items, nextCursor }`

### POST /v1/tenants/:id/vehicle-units
Body: `VehicleUnitInput` → `201 VehicleUnit` · Error: `409 PLAN_LIMIT_REACHED`

### PATCH /v1/vehicle-units/:unitId → `200 VehicleUnit`
### DELETE /v1/vehicle-units/:unitId → `204`

Products: pola sama dengan segmen `products`; filter `?category&priceMin&priceMax`.

### 7.3 Spec registry (kunci kanonik spesifikasi)

Spesifikasi yang dapat dibandingkan disimpan sebagai `Record<SpecKey, SpecValue>` dengan `SpecKey` dari registry tertutup di shared (`SPEC_DEFS`). Setiap nilai wajib cocok dengan `valueType` definisinya — validasi ini dilakukan schema, bukan backend.

```jsonc
"specs": { "mesin.kapasitas_cc": 1499, "transmisi.tipe": "cvt", "fitur.keyless": true }
```

Registry tetap **satu kamus flat**; yang di-namespace adalah *keberlakuan* tiap key per vertikal lewat field `verticals` (D-12). Key bersama seperti `mesin.kapasitas_cc` dan `transmisi.tipe` sengaja **tidak** diduplikasi, supaya tabel compare lintas key tetap sejajar.

| Helper shared | Kegunaan |
|---|---|
| `specKeysFor(vertical)` | key yang boleh muncul di editor varian |
| `specDefsFor(vertical)` / `specsByGroupFor(vertical)` | definisi & pengelompokan form |
| `comparableSpecKeysFor(vertical)` | baris tabel compare |
| `validateSpecsForVertical(vertical, specs)` | dipakai backend saat simpan & frontend saat submit |

Menyimpan key yang tidak berlaku di vertikal model (mis. `kaki.tipe_rangka` pada mobil) ditolak `422`.

Registry **append-only**: menghapus atau mengubah `key` = breaking change untuk data tenant yang sudah ada. Menambah key, atau menambah vertikal ke `verticals` key yang sudah ada, adalah minor. Field bebas tetap boleh diisi di `specsCustom[]`, tapi tidak ikut dibandingkan.

`SPEC_REGISTRY` (array, 18 key mobil rilis 1.0.0) masih ter-ekspor sebagai **deprecated** agar backend & frontend bisa di-upgrade tidak serentak; dihapus di major berikutnya.

---

### 7.4 Katalog seed kendaraan baru (publik, read-only)

Katalog adalah sumber **seed**, bukan sumber kebenaran berkelanjutan (keputusan D-10). Dibaca sekali saat onboarding (atau saat "tambah merk" di editor), hasilnya di-materialize sebagai `VehicleModel` milik tenant. **Setelah itu tidak ada sinkronisasi apa pun** — perubahan harga di katalog tidak pernah mengalir ke situs tenant yang sudah jadi. Karena itu tidak ada tabel referensi lintas-tenant, tidak ada purge fan-out ISR, dan endpoint `/render/*` tidak berubah sama sekali.

Endpoint di bawah ini **tanpa auth** (dipakai wizard sebelum tenant punya apa pun), tapi **rate-limited** dan hanya mengembalikan data katalog global. Tidak satu pun boleh membocorkan `tenantId`, data owner, atau status langganan (aturan §1.5 & §13).

#### GET /v1/catalog/brands?vertical=mobil|motor
→ `200 { brands: [{ id, slug, name }] }` — urut `order`, hanya `isActive`.

#### GET /v1/catalog/cities?vertical=mobil|motor
→ `200 { cities: [{ code, name, provinceCode, hasExactPrice }] }`

`hasExactPrice: false` → wizard **tetap boleh** memilih kota itu, tapi wajib menampilkan peringatan fallback (D-14). Jangan blokir pilihan.

#### GET /v1/catalog/models?brandId=…&cityCode=…
→ `200 { models: [{ id, slug, name, modelYear, bodyType, thumbnailUrl, popularityRank, variantCount, priceFrom, priceEstimated, priceEstimatedFromCity? }] }`

`priceFrom` = harga terendah hasil resolusi rantai kota. Rantai fallback (D-14), dihitung `buildCityChain()` di shared:

```
kota exact  →  ibukota provinsi  →  harga nasional (NATIONAL)
```

Setiap harga hasil fallback membawa `priceEstimated: true` sampai ke renderer publik. Aturan yang tidak boleh dilanggar: **lebih baik tidak ada angka daripada angka salah tanpa penanda.**

### 7.5 Materialize seed

#### POST /v1/tenants/:id/seed-inventory  *(auth: tenant owner)*
Body: `{ vertical, brandId, cityCode, modelIds: string[] }` — maks **30** `modelIds`
→ `201 { createdModels, createdVariants, skipped: [{ modelSlug, reason }], warnings: SeedWarning[] }`

`SeedWarning` (diteruskan apa adanya dari shared; frontend yang memformat):

```jsonc
{ "kind": "price_estimated",           "modelSlug": "avanza", "fromCity": "Semarang" }
{ "kind": "variant_skipped_no_price",  "modelSlug": "rush",   "variantSlug": "trd-at" }
{ "kind": "model_skipped_no_price",    "modelSlug": "hilux" }
```

Ketentuan:

- Pemetaan katalog → `VehicleModel` seluruhnya dari fungsi murni `seedFromCatalog()` di shared. Backend **dilarang** menulis ulang logika ini.
- `isPublished` hasil seed **selalu `false`**. Publikasi adalah tindakan sadar tenant, sekaligus menekan footprint duplicate content lintas subdomain.
- **Idempoten**: unique partial index `(tenant_id, catalog_variant_id)` + `ON CONFLICT DO NOTHING` — memanggil dua kali tidak menduplikasi record.
- Batas keras 30 model / 200 varian per panggilan; di atasnya `400 VALIDATION_ERROR`.
- Dipakai juga oleh tombol "Tambah merk" di editor (tanpa syarat status `draft`).

### 7.6 Round-trip harga lewat Excel

Pencocokan baris dilakukan **by `variantId`**, bukan by nama (keputusan D-16) — nama varian boleh di-rename tenant kapan saja.

#### GET /v1/tenants/:id/inventory/prices.xlsx  *(auth)* → binary xlsx
Sheet: kolom A `variantId` **hidden**; kolom B–E (`modelName`, `variantName`, `cityCode`, `cityName`) terkunci; kolom F `price` satu-satunya sel tidak terkunci (`numFmt '#,##0'`). Baris 1 header, baris 2 catatan berbahasa Indonesia, data mulai baris 3.

#### POST /v1/tenants/:id/inventory/prices.xlsx  *(auth, multipart)*
→ `200 { updated, skipped, warnings: [{ row, kind, message }] }`

`kind`: `name_mismatch` | `variant_not_found` | `price_invalid` | `no_change`

- Varian milik tenant lain → `variant_not_found`; **jangan pernah** membocorkan keberadaannya.
- Nama berbeda → `name_mismatch` sebagai **warning**, harga tetap diterapkan.
- Harga sama → `no_change`, `priceUpdatedAt` tidak disentuh.
- Setiap harga yang berubah men-set `priceSource: 'excel'`, `priceUpdatedAt: now`, `priceEstimated: false` (tenant sudah mengonfirmasi angkanya sendiri).
- Purge ISR hanya untuk tenant tersebut, setelah transaksi commit.

---

## 8. Leads

### POST /v1/public/:subdomain/leads  *(service-token; dipanggil Nuxt route, bukan browser)*
Body (`LeadPayload`):
```jsonc
{ "source": "test_drive",          // lama: contact | reservation · baru: test_drive | simulasi_kredit | hubungi_sales | brosur
  "nama": "Andi",
  "telepon": "081234567890",        // 08xx | 62xx | +62xx — dinormalisasi ke 62xx sebelum disimpan
  "email"?: "andi@contoh.id",
  "refType"?: "variant",            // model | variant | unit
  "refId"?: "uuid",                 // ATAU refSlug untuk halaman publik
  "refSlug"?: "xpander:ultimate",
  "refLabel"?: "Xpander Ultimate CVT",
  "meta"?: { "dp": 62500000, "tenorBulan": 36, "angsuran": 6555556, "metode": "flat" },
  "utm"?: { "source": "instagram", "medium"?: "...", "campaign"?: "promo-juli" },
  "hp"?: "",                        // honeypot — wajib kosong
  "turnstileToken"?: "..." }
```
→ `201 { "id": "uuid", "waDeepLink": "https://wa.me/62...?text=..." }` — memicu notifikasi WA (kanal utama) + email ke tenant via queue.
Error: `404 TENANT_NOT_FOUND`, `409 TENANT_NOT_ACTIVE`, `429 RATE_LIMITED`, `422 VALIDATION_ERROR`

Catatan kontrak:
- **Tanpa `tenantId` di body** — tenant diidentifikasi dari `:subdomain`; endpoint publik tidak pernah menyentuh ID internal.
- **`waDeepLink` disusun backend**, bukan frontend, supaya format pesan identik antara web, notifikasi ke sales, dan dashboard lead.
- `source: "simulasi_kredit"` dikirim *fire-and-forget* sebelum membuka WhatsApp — kegagalannya tidak boleh memblokir navigasi user.

### GET /v1/tenants/:id/leads
Query: `?source&refType&read&limit&cursor` → `200 { items: Lead[], nextCursor }`
`Lead`: `{ id, source, nama, telepon, email?, refType?, refId?, refSlug?, refLabel?, meta?, utm?, read, createdAt }`

### PATCH /v1/leads/:leadId
Body: `{ "read": true }` → `200 Lead`

---

## 9. Billing (Xendit)

### POST /v1/billing/subscribe
Header opsional: `Idempotency-Key`. Body: `{ "tenantId": "uuid", "plan": "monthly" | "yearly" }`
→ `201 { "invoiceId": "uuid", "invoiceUrl": "https://checkout.xendit.co/...", "amount": 300000, "expiresAt": "..." }`
Kanal bayar di invoice mengikuti plan: `yearly` = semua kanal; `monthly` = QRIS/e-wallet saja.
Error: `409 SUBSCRIPTION_ALREADY_ACTIVE`

### GET /v1/billing/status?tenantId=uuid
→ `200`:
```jsonc
{ "subscription": { "plan": "yearly", "status": "active",       // active | past_due | canceled | none
    "periodEnd": "2027-07-14T00:00:00Z" } | null,
  "invoices": [{ "id", "amount", "status", "paidAt", "invoiceUrl" }] }   // status: pending | paid | expired
```

### POST /v1/webhooks/xendit  *(inbound dari Xendit)*
- Verifikasi header `x-callback-token`; invalid → `401`.
- Idempotent by ID Xendit. Selalu balas `200` cepat; proses berat masuk queue.
- paid pertama → aktifkan subscription → **auto-publish tenant** → revalidate. paid perpanjangan → extend `periodEnd`. expired/failed → tandai sesuai.

Alur frontend pasca-subscribe: buka `invoiceUrl` → poll `GET /billing/status` (interval 3–5 dtk, maks 10 mnt) sampai `subscription.status=active` → tampilkan sukses + URL situs live. **Jangan pernah** menganggap paid dari redirect.

---

## 10. Render API (read path — konsumsi Nuxt SSR)

Semua endpoint: `X-Service-Token`, read-only, agresif di-cache (Redis, key per tenant+path). **Tidak pernah** memuat data internal (owner, email, billing). Tenant `draft`/`suspended`: hanya bisa diakses dengan `?preview=1` + validasi sesi owner (diteruskan Nuxt); selain itu `404`/`410`.

### GET /v1/render/:subdomain
→ `200 { "tenant": { "subdomain", "status", "publishedAt" }, "theme": TenantTheme, "template": { "slug" }, "nav": [{ "slug", "title" }], "contact": { "whatsapp", "address" }, "sales"?: { "mode": "baru"|"bekas"|"keduanya", "defaultCity": City|null, "cities": City[] } }`
`sales` hanya dikirim untuk tenant otomotif; `City` = `{ code, name }`.
Error: `404 TENANT_NOT_FOUND`, `410 TENANT_SUSPENDED`

### GET /v1/render/:subdomain/pages/:pageSlug
→ `200 { "page": { "slug", "title", "seoJson" }, "sections": [{ "sectionKey", "order", "styleJson", "blocks": Block[] }] }` — dari snapshot published (draft bila `?preview=1`).

### GET /v1/render/:subdomain/models  *(kendaraan baru — listing)*
Query: `?city&limit&cursor&q&vertical&brand&body&hargaMin&hargaMax&transmisi&bahanBakar&sort`
→ `200 { "city": City|null, "items": RenderModelCard[], "nextCursor" }`
`RenderModelCard`: `{ slug, vertical, brand, name, modelYear, bodyType, image, summary, priceFrom, priceEstimated, priceEstimatedFromCity?, variantCount, defaultVariantSlug }` — varian di-trim: hanya harga "mulai dari" di kota yang diminta.

`priceEstimated: true` → kartu **wajib** merender harga sebagai *"estimasi — hubungi untuk OTR {kota}"* (D-14), bukan sebagai OTR pasti. Sama berlakunya di halaman model dan varian, yang menerima `VehicleVariant` utuh berikut `priceEstimated`/`priceEstimatedFromCity`.

### GET /v1/render/:subdomain/models/:modelSlug
Query: `?city` → `200 { "city", "model": RenderModelSummary, "variants": VehicleVariant[], "defaultVariantSlug", "updatedAt" }`
`defaultVariantSlug` = varian `isFeatured`, fallback `trimRank` tertinggi.

### GET /v1/render/:subdomain/variants/:modelSlug/:variantSlug
Query: `?city` → `200 { "city", "model": RenderModelSummary, "variant": VehicleVariant, "price": OtrPrice|null, "siblings": [{ slug, name, trimRank, price, stockStatus }], "updatedAt" }`

### GET /v1/render/:subdomain/compare
Query: `?city&v=model:varian,model:varian` (maks 4 item, kelebihan dipotong dari kanan)
→ `200 { "city", "variants": VariantCompareView[], "specRows": SpecRow[], "canonicalV": "a:b,c:d", "ignored": string[], "curated": boolean }`

- **Backend yang menyusun matriks**, frontend hanya me-render — logika "spec mana yang muncul" harus identik di SSR & client (fungsi `susunSpecRows` di shared dipakai keduanya).
- Baris = spec `comparable` yang **berlaku di vertikal model** (`comparableSpecKeysFor`), urut sesuai registry; baris yang kosong di semua kolom dibuang.
- `SpecRow.values[i] === null` berarti **sales belum mengisi** — berbeda dari `false` (fitur tidak ada). Perbedaan ini wajib terlihat berbeda di UI.
- `SpecRow.winners` hanya terisi untuk `valueType: "number"` yang punya `higherIsBetter`.
- Item `?v=` yang tidak valid/tidak ditemukan **diabaikan** dan dilaporkan di `ignored` — bukan error page.
- `canonicalV` = daftar terurut alfabetis, untuk `<link rel="canonical">` supaya `a,b` dan `b,a` tidak jadi dua halaman.
- `curated: true` bila kombinasi ada di `settingsJson.curatedComparisons[]` → halaman boleh di-`index`; selain itu frontend memasang `noindex, follow`.

### GET /v1/render/:subdomain/units · /products  *(mobil bekas & produk)*
Query filter sama dengan §7 → `200 { items, nextCursor }` (hanya field publik).

### GET /v1/render/:subdomain/units/:slug · /products/:slug
→ `200` item penuh untuk VDP/PDP (+ field yang dibutuhkan JSON-LD).

### GET /v1/render/:subdomain/sitemap
→ `200 { "urls": [{ "path": "/", "updatedAt" }, { "path": "/mobil/xpander", "updatedAt" }, { "path": "/mobil/xpander/ultimate", "updatedAt" }] }`
Sitemap wajib mencakup halaman model **dan** semua halaman varian. Halaman `/bandingkan` tidak masuk sitemap.

---

## 11. Internal: Revalidate (NestJS → Nuxt)

### POST {NUXT_ORIGIN}/api/_internal/revalidate
Header: `X-Service-Token`. Body: `{ "subdomain": "warungbudi", "paths": ["/", "/mobil/toyota-avanza-2024"] | "*" }`
→ `200 { "purged": number }`
Dipanggil saat: publish, update collection item, suspend/reaktivasi. Gagal → retry via queue (backend).

---

## 12. Katalog Kode Error

| HTTP | code | Keterangan |
|---|---|---|
| 400 | `BAD_REQUEST` | Request malformed (bukan gagal validasi field) |
| 401 | `UNAUTHORIZED` / `INVALID_CREDENTIALS` / `INVALID_REFRESH_TOKEN` | Autentikasi |
| 402 | `PAYWALL_REQUIRED` | Publish tanpa subscription aktif; `details.plans` |
| 403 | `FORBIDDEN` | Bukan pemilik tenant/resource |
| 404 | `NOT_FOUND` / `TENANT_NOT_FOUND` | Resource tidak ada |
| 409 | `EMAIL_TAKEN` · `SUBDOMAIN_TAKEN` · `SUBDOMAIN_LOCKED` · `SLUG_TAKEN` · `CONFIRMATION_REQUIRED` · `TENANT_ALREADY_ACTIVE` · `TENANT_NOT_ACTIVE` · `SUBSCRIPTION_ALREADY_ACTIVE` · `TENANT_LIMIT_REACHED` · `PLAN_LIMIT_REACHED` | Konflik state |
| 410 | `TENANT_SUSPENDED` | Situs dinonaktifkan (render path) |
| 422 | `VALIDATION_ERROR` · `SUBDOMAIN_RESERVED` · `CONTENT_INCOMPLETE` · `BLOCK_NOT_ALLOWED_IN_SLOT` · `UNSUPPORTED_MEDIA_TYPE` · `FILE_TOO_LARGE` | Gagal validasi (sertakan `fieldErrors`/`details`) |
| 429 | `RATE_LIMITED` | + header `Retry-After` |
| 500 | `INTERNAL` | Jangan bocorkan detail; sertakan `X-Request-Id` |

---

## 13. Checklist konsistensi implementasi

- [ ] Semua bentuk body/response di dokumen ini punya schema/DTO padanan di `@marketplaceindo/shared` (`WizardAnswers`, `Block`, `SectionStyle`, `TenantTheme`, `TenantSettings`, `VehicleModel`, `VehicleVariant`, `VehicleUnit`, `Product`, `PageSeo`, `SpecRow`, `VariantCompareView`, DTO auth/billing/leads).
- [ ] Perhitungan angsuran & penyusunan matriks compare memakai fungsi murni dari shared (`hitungAngsuran`, `ringkasanKredit`, `susunSpecRows`, `parseCompareParam`) — tidak ditulis ulang di backend/frontend, supaya angka di layar, di pesan WA, dan di SSR selalu sama.
- [ ] nestjs-zod dipakai sebagai ValidationPipe → error otomatis berformat §1.4.
- [ ] Frontend & backend hanya mengimpor tipe dari `@marketplaceindo/shared` (versi **pasti**, tanpa `^`/`~`), tidak mendefinisikan ulang bentuk API.
- [ ] Perubahan endpoint mengikuti alur multi-repo: update schema di repo shared → bump versi (semver, lihat PLAN-SHARED.md) → publish → perbarui dokumen ini di repo shared → repo backend & frontend upgrade versi secara eksplisit di PR masing-masing.
- [ ] Master copy `API-CONTRACT.md` hidup di repo shared; salinan di `docs/` repo backend & frontend disamakan setiap upgrade versi shared.
