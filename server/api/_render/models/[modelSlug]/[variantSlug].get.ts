import { fetchRenderVariant } from "../../../../utils/render-client";

/** Proxy internal → GET /v1/render/:subdomain/variants/:modelSlug/:variantSlug. */
export default defineEventHandler((event) => {
  const routing = event.context.tenant;
  if (!routing || routing.mode !== "tenant") {
    throw createError({ statusCode: 404, message: "Bukan situs tenant" });
  }
  const query = getQuery(event);
  return fetchRenderVariant(
    event,
    routing.subdomain,
    getRouterParam(event, "modelSlug")!,
    getRouterParam(event, "variantSlug")!,
    { preview: query.preview === "1", city: query.city ? String(query.city) : undefined },
  );
});
