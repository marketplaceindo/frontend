import { slugSchema } from "@marketplaceindo/shared";
import { fetchRenderUnit } from "../../../utils/render-client";

/** Item kendaraan penuh untuk VDP (subdomain dari Host). */
export default defineEventHandler((event) => {
  const routing = event.context.tenant;
  if (!routing || routing.mode !== "tenant") {
    throw createError({ statusCode: 404, message: "Bukan situs tenant" });
  }
  const slug = slugSchema.safeParse(getRouterParam(event, "slug"));
  if (!slug.success) {
    throw createError({ statusCode: 404, message: "Unit tidak ditemukan" });
  }
  const preview = getQuery(event).preview === "1";
  return fetchRenderUnit(event, routing.subdomain, slug.data, { preview });
});
