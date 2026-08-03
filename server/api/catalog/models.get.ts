import { apiCatalogModels } from "../../utils/dashboard-api";

/** Proxy GET /v1/catalog/models?brandId&cityCode — kartu pemilih model (D-13). */
export default defineEventHandler(async (event) => {
  const { brandId, cityCode } = getQuery(event);
  return apiCatalogModels(event, String(brandId ?? ""), String(cityCode ?? ""));
});
