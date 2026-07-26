import { apiReplaceBlocks } from "../../../../../utils/dashboard-api";

/**
 * Proxy PUT /v1/pages/:pageId/sections/:sectionId/blocks — bulk replace.
 * Validasi per-item menghasilkan fieldErrors ber-index (`blocks.0.data.heading`)
 * sehingga form editor bisa memetakannya balik ke field yang tepat.
 */
export default defineEventHandler(async (event) => {
  const pageId = getRouterParam(event, "pageId")!;
  const sectionId = getRouterParam(event, "sectionId")!;
  const body = await readBody(event);
  return apiReplaceBlocks(event, pageId, sectionId, body);
});
