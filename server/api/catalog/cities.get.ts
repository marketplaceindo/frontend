import { vehicleVerticalSchema } from "@marketplaceindo/shared";
import { apiCatalogCities } from "../../utils/dashboard-api";

/**
 * Proxy GET /v1/catalog/cities?vertical. `hasExactPrice: false` TIDAK memblokir
 * pilihan — wizard menampilkan peringatan fallback (D-14).
 */
export default defineEventHandler(async (event) => {
  const { vertical } = getQuery(event);
  return apiCatalogCities(event, vehicleVerticalSchema.catch("mobil").parse(vertical));
});
