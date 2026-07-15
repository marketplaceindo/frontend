import { fetchRenderSite } from "../../utils/render-client";

/**
 * Proxy internal untuk browser/SSR situs tenant → render API.
 * Subdomain SELALU diambil dari Host (event.context.tenant), tidak pernah dari
 * input klien — browser tidak bisa membaca data tenant lain lewat route ini.
 */
export default defineEventHandler((event) => {
  const routing = event.context.tenant;
  if (!routing || routing.mode !== "tenant") {
    throw createError({ statusCode: 404, message: "Bukan situs tenant" });
  }
  const preview = getQuery(event).preview === "1";
  return fetchRenderSite(event, routing.subdomain, { preview });
});
