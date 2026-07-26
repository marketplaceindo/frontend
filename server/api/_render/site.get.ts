import { fetchRenderSite } from "../../utils/render-client";
import { cachedRenderHandler } from "../../utils/render-cache";

/**
 * Proxy internal untuk browser/SSR situs tenant → render API.
 * Subdomain SELALU diambil dari Host (event.context.tenant), tidak pernah dari
 * input klien — browser tidak bisa membaca data tenant lain lewat route ini.
 * Response di-cache per tenant (Fase 8); `?preview=1` selalu melewati cache.
 */
export default cachedRenderHandler("render-site", (event) => {
  const routing = event.context.tenant;
  if (!routing || routing.mode !== "tenant") {
    throw createError({ statusCode: 404, message: "Bukan situs tenant" });
  }
  const preview = getQuery(event).preview === "1";
  return fetchRenderSite(event, routing.subdomain, { preview });
});
