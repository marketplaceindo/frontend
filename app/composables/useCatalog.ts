import type {
  CatalogBrandsResponse,
  CatalogCitiesResponse,
  CatalogModelsResponse,
  InventoryPriceImportResult,
  SeedInventoryRequest,
  SeedInventoryResult,
  VehicleVertical,
} from "@marketplaceindo/shared";

/**
 * Katalog seed & harga massal — semua lewat proxy Nitro, browser tidak pernah
 * memanggil NestJS langsung. Error dibiarkan dilempar supaya pemanggil
 * memformat `fieldErrors`/`details` (§1.4) lewat `apiErrorOf`.
 */
export function useCatalog() {
  const fetchApi = useRequestFetch();

  const brands = (vertical: VehicleVertical) =>
    fetchApi<CatalogBrandsResponse>("/api/catalog/brands", { query: { vertical } });

  const cities = (vertical: VehicleVertical) =>
    fetchApi<CatalogCitiesResponse>("/api/catalog/cities", { query: { vertical } });

  const models = (brandId: string, cityCode: string) =>
    fetchApi<CatalogModelsResponse>("/api/catalog/models", { query: { brandId, cityCode } });

  const seedInventory = (tenantId: string, body: SeedInventoryRequest) =>
    fetchApi<SeedInventoryResult>(`/api/tenants/${tenantId}/seed-inventory`, {
      method: "POST",
      body,
    });

  /** URL unduhan; dibuka lewat navigasi biasa supaya browser menyimpannya. */
  const priceFileUrl = (tenantId: string) => `/api/tenants/${tenantId}/inventory/prices`;

  const importPrices = (tenantId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetchApi<InventoryPriceImportResult>(`/api/tenants/${tenantId}/inventory/prices`, {
      method: "POST",
      body: form,
    });
  };

  return { brands, cities, models, seedInventory, priceFileUrl, importPrices };
}
