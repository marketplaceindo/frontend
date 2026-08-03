/**
 * Flag `import.meta` bawaan Nuxt untuk project TS test.
 *
 * `tests/tsconfig.json` mengetik ulang sebagian `app/utils/*` di luar graph
 * `.nuxt/*` (yang menyediakan tipe ini), jadi `import.meta.server` di
 * `app/utils/analytics.ts` tidak dikenal di sana. Deklarasi ini hanya untuk
 * typecheck project test — runtime-nya tetap dari Nuxt.
 */
interface ImportMeta {
  /** Kode sedang berjalan di server (SSR/Nitro). */
  readonly server: boolean;
  /** Kode sedang berjalan di browser. */
  readonly client: boolean;
  /** Build development. */
  readonly dev: boolean;
}
