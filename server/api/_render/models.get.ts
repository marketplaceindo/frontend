import { fetchRenderModels } from "../../utils/render-client";

/**
 * Proxy internal → GET /v1/render/:subdomain/models (mobil baru).
 * Subdomain SELALU dari Host, tidak pernah dari input klien.
 */
export default defineEventHandler((event) => {
  const routing = event.context.tenant;
  if (!routing || routing.mode !== "tenant") {
    throw createError({ statusCode: 404, message: "Bukan situs tenant" });
  }
  const { preview, ...query } = getQuery(event);
  return fetchRenderModels(event, routing.subdomain, query, { preview: preview === "1" });
});
