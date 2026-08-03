import { apiExportPrices } from "../../../../utils/dashboard-api";

/** Unduhan file harga inventaris (kontrak §7.6). Jangan pernah di-cache. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const { body, contentType, filename } = await apiExportPrices(event, id);
  setHeader(event, "content-type", contentType);
  setHeader(event, "content-disposition", `attachment; filename="${filename}"`);
  setHeader(event, "cache-control", "no-store");
  return body;
});
