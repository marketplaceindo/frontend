import { apiCreateCollectionItem } from "../../../utils/dashboard-api";

/** Proxy POST /v1/tenants/:id/vehicles. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const item = await apiCreateCollectionItem(event, "vehicles", getRouterParam(event, "id")!, body);
  setResponseStatus(event, 201);
  return item;
});
