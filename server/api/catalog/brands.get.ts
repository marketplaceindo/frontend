import { vehicleVerticalSchema } from "@marketplaceindo/shared";
import { apiCatalogBrands } from "../../utils/dashboard-api";

/** Proxy GET /v1/catalog/brands?vertical — grid pemilih merk di wizard (§7.4). */
export default defineEventHandler(async (event) => {
  const { vertical } = getQuery(event);
  return apiCatalogBrands(event, vehicleVerticalSchema.catch("mobil").parse(vertical));
});
