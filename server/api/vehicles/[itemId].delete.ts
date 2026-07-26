import { apiDeleteCollectionItem } from "../../utils/dashboard-api";

/** Proxy DELETE /v1/vehicles/:vehicleId → 204. */
export default defineEventHandler(async (event) => {
  await apiDeleteCollectionItem(event, "vehicles", getRouterParam(event, "itemId")!);
  setResponseStatus(event, 204);
  return null;
});
