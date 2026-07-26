import { apiUpdateCollectionItem } from "../../utils/dashboard-api";

/** Proxy PATCH /v1/vehicles/:vehicleId. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  return apiUpdateCollectionItem(event, "vehicles", getRouterParam(event, "itemId")!, body);
});
