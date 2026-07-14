# Kontrak API — Platform Multi-Tenant Website Builder

Dokumen ini adalah **satu-satunya sumber kebenaran** untuk API antara backend (NestJS) dan frontend (Nuxt). Semua bentuk request/response merujuk ke schema Zod di package `@marketplaceindo/shared` (repo terpisah, GitHub Packages — lihat `PLAN-SHARED.md`) — jika dokumen ini dan schema shared berbeda, schema shared yang menang dan dokumen ini harus diperbarui.

Status: Draft v1 · Berlaku untuk prefix `/v1`

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

---

## 7. Collections (Vehicles & Products)

Tipe `Vehicle`/`Product` mengikuti schema shared; keduanya punya `slug` unik per tenant (auto-generate dari nama, bisa dioverride).

Pola endpoint identik untuk kedua koleksi (contoh: vehicles):

### GET /v1/tenants/:id/vehicles
Query: `?limit&cursor&q&brand&priceMin&priceMax&year&transmission` → `200 { items, nextCursor }`

### POST /v1/tenants/:id/vehicles
Body: `Vehicle` → `201 Vehicle` · Error: `409 PLAN_LIMIT_REACHED` (mis. 50 item di plan dasar)

### PATCH /v1/vehicles/:vehicleId → `200 Vehicle`
### DELETE /v1/vehicles/:vehicleId → `204`

Products: ganti segmen `vehicles` → `products`; filter `?category&priceMin&priceMax`.

---

## 8. Leads

### POST /v1/public/:subdomain/leads  *(service-token; dipanggil Nuxt route, bukan browser)*
Body:
```jsonc
{ "type": "test_drive" | "contact" | "reservation",
  "payload": { "name": "...", "phone": "...", "date"?: "...", "message"?: "..." },
  "sourceItemSlug"?: "toyota-avanza-2024",
  "turnstileToken"?: "..." }
```
→ `201 { "id": "uuid" }` — memicu notifikasi WA (kanal utama) + email ke tenant via queue.
Error: `404 TENANT_NOT_FOUND`, `409 TENANT_NOT_ACTIVE`, `429 RATE_LIMITED`, `422 VALIDATION_ERROR`

### GET /v1/tenants/:id/leads
Query: `?type&read&limit&cursor` → `200 { items: Lead[], nextCursor }`
`Lead`: `{ id, type, payload, sourceItemSlug?, read, createdAt }`

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
→ `200 { "tenant": { "subdomain", "status", "publishedAt" }, "theme": TenantTheme, "template": { "slug" }, "nav": [{ "slug", "title" }], "contact": { "whatsapp", "address" } }`
Error: `404 TENANT_NOT_FOUND`, `410 TENANT_SUSPENDED`

### GET /v1/render/:subdomain/pages/:pageSlug
→ `200 { "page": { "slug", "title", "seoJson" }, "sections": [{ "sectionKey", "order", "styleJson", "blocks": Block[] }] }` — dari snapshot published (draft bila `?preview=1`).

### GET /v1/render/:subdomain/vehicles · /products
Query filter sama dengan §7 → `200 { items, nextCursor }` (hanya field publik).

### GET /v1/render/:subdomain/vehicles/:slug · /products/:slug
→ `200` item penuh untuk VDP/PDP (+ field yang dibutuhkan JSON-LD).

### GET /v1/render/:subdomain/sitemap
→ `200 { "urls": [{ "path": "/", "updatedAt" }, { "path": "/mobil/toyota-avanza-2024", "updatedAt" }] }`

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

- [ ] Semua bentuk body/response di dokumen ini punya schema/DTO padanan di `@marketplaceindo/shared` (`WizardAnswers`, `Block`, `SectionStyle`, `TenantTheme`, `Vehicle`, `Product`, `PageSeo`, DTO auth/billing/leads).
- [ ] nestjs-zod dipakai sebagai ValidationPipe → error otomatis berformat §1.4.
- [ ] Frontend & backend hanya mengimpor tipe dari `@marketplaceindo/shared` (versi **pasti**, tanpa `^`/`~`), tidak mendefinisikan ulang bentuk API.
- [ ] Perubahan endpoint mengikuti alur multi-repo: update schema di repo shared → bump versi (semver, lihat PLAN-SHARED.md) → publish → perbarui dokumen ini di repo shared → repo backend & frontend upgrade versi secara eksplisit di PR masing-masing.
- [ ] Master copy `API-CONTRACT.md` hidup di repo shared; salinan di `docs/` repo backend & frontend disamakan setiap upgrade versi shared.
