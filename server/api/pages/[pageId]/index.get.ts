import { apiGetPage } from "../../../utils/dashboard-api";

/** Proxy GET /v1/pages/:pageId — payload penuh (sections + blocks) untuk editor. */
export default defineEventHandler((event) => {
  const pageId = getRouterParam(event, "pageId")!;
  return apiGetPage(event, pageId);
});
