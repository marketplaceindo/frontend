import {
  canonicalCompareParam,
  compareRefKey,
  parseCompareParam,
  type CompareRef,
} from "@marketplaceindo/shared";

/** Batas kolom yang masih terbaca: 3 di mobile, 4 di desktop (addendum §5B.1). */
export const MAX_COMPARE_MOBILE = 3;
export const MAX_COMPARE_DESKTOP = 4;

const COOKIE = "mi_compare";

/**
 * Store perbandingan varian (addendum Fase 5B.1).
 *
 * Dipersist ke **cookie**, bukan localStorage: isi tray harus sudah terbaca saat
 * SSR supaya bar tidak berkedip muncul setelah hidrasi, dan supaya halaman
 * `/bandingkan` bisa di-render penuh di server.
 */
export function useCompare() {
  const cookie = useCookie<string | null>(COOKIE, {
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    path: "/",
  });

  const items = useState<CompareRef[]>("compare-items", () =>
    parseCompareParam(cookie.value),
  );

  /** Batas mengikuti lebar layar; di server pakai batas mobile (paling ketat). */
  const max = computed(() =>
    import.meta.client && window.innerWidth >= 1024 ? MAX_COMPARE_DESKTOP : MAX_COMPARE_MOBILE,
  );

  function simpan() {
    cookie.value = items.value.length ? canonicalCompareParam(items.value) : null;
  }

  function has(ref: CompareRef): boolean {
    const key = compareRefKey(ref);
    return items.value.some((i) => compareRefKey(i) === key);
  }

  function toggle(ref: CompareRef): void {
    const key = compareRefKey(ref);
    const next = items.value.filter((i) => compareRefKey(i) !== key);
    if (next.length === items.value.length) {
      // Belum ada → tambahkan, buang yang paling lama bila melewati batas.
      next.push(ref);
      while (next.length > max.value) next.shift();
    }
    items.value = next;
    simpan();
  }

  function remove(ref: CompareRef): void {
    const key = compareRefKey(ref);
    items.value = items.value.filter((i) => compareRefKey(i) !== key);
    simpan();
  }

  function clear(): void {
    items.value = [];
    simpan();
  }

  /** URL kanonik halaman perbandingan (urut alfabetis → satu URL per kombinasi). */
  const href = computed(() => `/bandingkan?v=${canonicalCompareParam(items.value)}`);

  return { items, max, has, toggle, remove, clear, href };
}

/**
 * Kota aktif (D-03) — memengaruhi harga di listing, VDP, compare, dan simulasi
 * kredit sekaligus. Cookie supaya SSR sudah tahu kota pilihan user.
 */
export function useKotaAktif() {
  const cookie = useCookie<string | null>("mi_kota", {
    maxAge: 60 * 60 * 24 * 180,
    sameSite: "lax",
    path: "/",
  });
  const state = useState<string>("kota-aktif", () => cookie.value ?? "");
  watch(state, (nilai) => (cookie.value = nilai || null));
  return state;
}
