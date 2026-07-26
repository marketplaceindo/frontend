import { apiUpdatePage } from "../../../utils/dashboard-api";

/** Proxy PATCH /v1/pages/:pageId — judul & SEO halaman. */
export default defineEventHandler(async (event) => {
  const pageId = getRouterParam(event, "pageId")!;
  const body = await readBody(event);
  return apiUpdatePage(event, pageId, body);
});
