# CLAUDE.md

## Peran repo ini

- Repo FRONTEND: Nuxt 4 SSR (situs tenant) + dashboard. Ikuti docs/PLAN-FRONTEND.md.

## Keputusan terkunci (JANGAN diubah tanpa persetujuan eksplisit user)

- Status tenant: draft → active → suspended. Paywall di endpoint publish (402 PAYWALL_REQUIRED).
- Funnel: daftar gratis → wizard → preview → bayar saat publish. Tahunan Rp300rb = hero; bulanan Rp30rb = QRIS/e-wallet saja.
- Browser TIDAK PERNAH memanggil NestJS langsung (dashboard via proxy Nitro; render & leads server-to-server dengan X-Service-Token).
- Format error API mengikuti docs/API-CONTRACT.md §1.4 (code, message bahasa Indonesia, fieldErrors dot-notation Zod).
- Semua bentuk data API diimpor dari @marketplaceindo/shared versi PASTI (tanpa ^/~). DILARANG mendefinisikan ulang schema/DTO di repo ini. DILARANG mengubah isi package shared dari repo ini.
- Mobile-first untuk seluruh UI dashboard/editor.

## Aturan kerja agent

- Kerjakan HANYA fase yang diminta di prompt; berhenti saat Definition of Done fase itu tercapai, lalu laporkan buktinya.
- Jika planning dan API-CONTRACT tampak bertentangan, atau butuh perubahan schema shared: BERHENTI dan tanyakan ke user. Jangan berimprovisasi mengubah kontrak.
- Jalankan typecheck + test sebelum menyatakan selesai. Jangan commit kode yang gagal build.
- Commit kecil dan sering dengan pesan jelas; jangan push tanpa diminta.
