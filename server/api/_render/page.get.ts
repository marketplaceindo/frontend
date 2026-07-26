import { slugSchema } from "@marketplaceindo/shared";
import { fetchRenderPage } from "../../utils/render-client";
import { cachedRenderHandler } from "../../utils/render-cache";

/**
 * Konten satu halaman tenant; slug via query (?slug=home), subdomain dari Host.
 * Di-cache per tenant+slug (Fase 8); `?preview=1` selalu melewati cache.
 */
export default cachedRenderHandler(
  "render-page",
  (event) => {
    const routing = event.context.tenant;
    if (!routing || routing.mode !== "tenant") {
      throw createError({ statusCode: 404, message: "Bukan situs tenant" });
    }
    const query = getQuery(event);
    const slug = slugSchema.safeParse(query.slug ?? "home");
    if (!slug.success) {
      throw createError({ statusCode: 404, message: "Halaman tidak ditemukan" });
    }
    const preview = query.preview === "1";
    return fetchRenderPage(event, routing.subdomain, slug.data, { preview });
  },
  ["slug"],
);
