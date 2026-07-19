import { fetchRenderProducts } from "../../utils/render-client";

/** List produk tenant (filter §7 diteruskan apa adanya; subdomain dari Host). */
export default defineEventHandler((event) => {
  const routing = event.context.tenant;
  if (!routing || routing.mode !== "tenant") {
    throw createError({ statusCode: 404, message: "Bukan situs tenant" });
  }
  const { preview, ...query } = getQuery(event);
  return fetchRenderProducts(event, routing.subdomain, query, { preview: preview === "1" });
});
