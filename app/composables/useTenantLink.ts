/**
 * Pembuat tautan internal situs tenant yang sadar mode pratinjau.
 *
 * Dipakai setiap komponen/halaman yang menaut ke halaman lain di situs yang
 * sama. Lihat `app/utils/tenant-link.ts` untuk alasan lengkapnya.
 */
export function useTenantLink() {
  const route = useRoute();
  const preview = computed(() => route.query.preview === "1");

  /** Tautan internal yang tetap membawa `preview=1` bila sedang pratinjau. */
  function tautan(href: string): string {
    return withPreview(href, preview.value);
  }

  return { preview, tautan };
}
