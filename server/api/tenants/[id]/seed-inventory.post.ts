import { apiSeedInventory } from "../../../utils/dashboard-api";

/**
 * Proxy POST /v1/tenants/:id/seed-inventory — materialisasi katalog jadi
 * inventaris tenant. Hasilnya `isPublished: false` seluruhnya; `warnings`
 * diteruskan apa adanya untuk diformat wizard.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const body = await readBody(event);
  return apiSeedInventory(event, id, body);
});
