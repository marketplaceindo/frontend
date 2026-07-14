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

> **⚠️ Status sementara (2026-07-14):** token `read:packages` belum tersedia di mesin dev, jadi `@marketplaceindo/shared` di-install dari tarball lokal `vendor/marketplaceindo-shared-0.1.0.tgz` (hasil `npm pack` repo shared — isinya identik dengan artefak publish). Setelah token tersedia, kembalikan ke registry:
>
> ```bash
> npm install @marketplaceindo/shared@0.1.0 --save-exact
> rm -rf vendor
> ```

## Aturan versi shared

- `@marketplaceindo/shared` dipasang dengan **versi pasti** (tanpa `^`/`~`). Upgrade selalu eksplisit: baca CHANGELOG rilisnya, bump versi, sesuaikan kode, typecheck + test hijau.
- **DILARANG mendefinisikan ulang schema/DTO API di repo ini.** Semua bentuk data API (block, section, theme, collection, request/response, konstanta) diimpor dari `@marketplaceindo/shared`. Butuh perubahan bentuk data? Berhenti — perubahan dilakukan di repo shared (lihat `docs/PLAN-SHARED.md` di repo shared), bukan di sini.
- Catatan penamaan: schema runtime memakai suffix `Schema` (mis. `blockSchema.safeParse(...)`), sedangkan `Block` adalah tipe hasil `z.infer`.

## Perintah

```bash
npm run typecheck   # tsc --noEmit (strict, wajib untuk Zod 4)
npm test            # vitest — termasuk smoke test konsumsi package shared
```
