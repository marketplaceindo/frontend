import { slugSchema } from "@marketplaceindo/shared";
import { fetchRenderProduct } from "../../../utils/render-client";

/** Item produk penuh untuk PDP (subdomain dari Host). */
export default defineEventHandler((event) => {
  const routing = event.context.tenant;
  if (!routing || routing.mode !== "tenant") {
    throw createError({ statusCode: 404, message: "Bukan situs tenant" });
  }
  const slug = slugSchema.safeParse(getRouterParam(event, "slug"));
  if (!slug.success) {
    throw createError({ statusCode: 404, message: "Produk tidak ditemukan" });
  }
  const preview = getQuery(event).preview === "1";
  return fetchRenderProduct(event, routing.subdomain, slug.data, { preview });
});
