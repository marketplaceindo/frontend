import { fetchRenderSite } from "../utils/render-client";
import { requestOrigin } from "../utils/request-origin";

/**
 * robots.txt per-tenant:
 * - situs tenant publik (active) → izinkan crawl + tunjuk sitemap;
 * - tenant draft/suspended/tidak ada, dan host dashboard/app → blokir total
 *   (situs non-publik & panel dashboard tidak boleh terindeks).
 * Selalu 200 text (robots.txt tidak boleh error).
 */
export default defineEventHandler(async (event) => {
  setHeader(event, "Content-Type", "text/plain; charset=utf-8");
  setHeader(event, "Cache-Control", "public, max-age=300, s-maxage=300");

  const routing = event.context.tenant;
  const disallowAll = "User-agent: *\nDisallow: /\n";

  if (!routing || routing.mode !== "tenant") return disallowAll;

  try {
    // Lempar 404/410 bila draft/suspended → jatuh ke blokir total.
    await fetchRenderSite(event, routing.subdomain);
  } catch {
    return disallowAll;
  }

  return `User-agent: *\nAllow: /\n\nSitemap: ${requestOrigin(event)}/sitemap.xml\n`;
});
