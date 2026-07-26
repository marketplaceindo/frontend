import { apiDeletePage } from "../../../utils/dashboard-api";

/** Proxy DELETE /v1/pages/:pageId → 204. */
export default defineEventHandler(async (event) => {
  const pageId = getRouterParam(event, "pageId")!;
  await apiDeletePage(event, pageId);
  setResponseStatus(event, 204);
  return null;
});
