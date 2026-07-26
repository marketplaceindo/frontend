import { apiUpdateSection } from "../../../../../utils/dashboard-api";

/** Proxy PATCH /v1/pages/:pageId/sections/:sectionId — style, urutan, aktif/nonaktif. */
export default defineEventHandler(async (event) => {
  const pageId = getRouterParam(event, "pageId")!;
  const sectionId = getRouterParam(event, "sectionId")!;
  const body = await readBody(event);
  return apiUpdateSection(event, pageId, sectionId, body);
});
