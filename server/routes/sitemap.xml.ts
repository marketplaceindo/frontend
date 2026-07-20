import { fetchRenderSitemap } from "../utils/render-client";
import { requestOrigin } from "../utils/request-origin";

/** Escape karakter XML pada URL loc (& < > " '). */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * sitemap.xml per-tenant. Hanya untuk situs publik (active): draft/suspended
 * → 404/410 (tidak ada sitemap untuk situs yang tak boleh terindeks).
 * Host dashboard → 404 (bukan situs tenant).
 */
export default defineEventHandler(async (event) => {
  const routing = event.context.tenant;
  if (!routing || routing.mode !== "tenant") {
    throw createError({ statusCode: 404, statusMessage: "Not Found" });
  }

  // Tanpa preview: draft/suspended dilempar oleh render API (404/410).
  const { urls } = await fetchRenderSitemap(event, routing.subdomain);
  const origin = requestOrigin(event);

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${xmlEscape(origin + u.path)}</loc><lastmod>${u.updatedAt}</lastmod></url>`,
      )
      .join("\n") +
    `\n</urlset>\n`;

  setHeader(event, "Content-Type", "application/xml; charset=utf-8");
  setHeader(event, "Cache-Control", "public, max-age=300, s-maxage=300");
  return body;
});
