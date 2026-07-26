import { apiTemplateDetail } from "../../utils/dashboard-api";

/** Proxy GET /v1/templates/:slug — termasuk structureJson (slot & block yang diizinkan). */
export default defineEventHandler((event) => {
  const slug = getRouterParam(event, "slug")!;
  return apiTemplateDetail(event, slug);
});
