import { fetchRenderCompare } from "../../utils/render-client";

/**
 * Proxy internal → GET /v1/render/:subdomain/compare. Backend yang menyusun
 * matriks spesifikasi supaya logika "baris mana yang muncul" identik di SSR
 * maupun klien (addendum §5).
 */
export default defineEventHandler((event) => {
  const routing = event.context.tenant;
  if (!routing || routing.mode !== "tenant") {
    throw createError({ statusCode: 404, message: "Bukan situs tenant" });
  }
  const query = getQuery(event);
  return fetchRenderCompare(event, routing.subdomain, String(query.v ?? ""), {
    preview: query.preview === "1",
    city: query.city ? String(query.city) : undefined,
  });
});
