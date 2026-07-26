/**
 * Cache ISR untuk jalur baca situs tenant (Fase 8).
 *
 * Yang di-cache adalah **response render API per tenant**, bukan HTML halaman.
 * Alasannya: mode dashboard dan situs tenant berbagi path yang sama (`/`,
 * `/<slug>`) dan hanya dibedakan oleh Host, sedangkan `routeRules` Nitro
 * berbasis path — men-cache HTML `/` secara global berisiko menyajikan halaman
 * dashboard milik satu user ke user lain. Route `/api/_render/*` sebaliknya
 * murni data tenant (tidak pernah memuat data user), dan subdomain-nya selalu
 * diambil dari Host, jadi aman di-cache selama kuncinya memuat subdomain.
 *
 * Preview TIDAK PERNAH di-cache: editor harus melihat perubahannya seketika.
 *
 * Bentuk kunci (fungsi murni + teruji) ada di `render-cache-key.ts`.
 */
import type { H3Event } from "h3";
// Konstanta & pencocokan kunci sengaja TIDAK di-re-export dari sini: keduanya
// modul server/utils yang sama-sama auto-import, jadi nama ganda akan bentrok.
import {
  RENDER_CACHE_GROUP,
  RENDER_CACHE_TTL,
  buildRenderCacheKey,
} from "./render-cache-key";

/** Subdomain request berjalan (selalu dari Host, tidak pernah dari input klien). */
function subdomainOf(event: H3Event): string {
  const routing = event.context.tenant;
  return routing && routing.mode === "tenant" ? routing.subdomain : "_";
}

/** `preview=1` melewati cache sepenuhnya (draft berubah tiap simpan). */
function isPreview(event: H3Event): boolean {
  return getQuery(event).preview === "1";
}

export function renderCacheKey(event: H3Event, extraKeys: string[] = []): string {
  const query = getQuery(event);
  return buildRenderCacheKey(
    subdomainOf(event),
    extraKeys.map((key) => String(query[key] ?? "")),
  );
}

/** Bungkus handler render jadi cached handler ber-TTL dengan kunci per-tenant. */
export function cachedRenderHandler<T>(
  name: string,
  handler: (event: H3Event) => T | Promise<T>,
  extraKeys: string[] = [],
) {
  return defineCachedEventHandler(handler, {
    name,
    group: RENDER_CACHE_GROUP,
    maxAge: RENDER_CACHE_TTL,
    // Sajikan versi lama sambil menyegarkan di belakang layar (stale-while-revalidate).
    swr: true,
    getKey: (event) => renderCacheKey(event, extraKeys),
    shouldBypassCache: isPreview,
  });
}
