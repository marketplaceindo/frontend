import { apiCreateCollectionItem } from "../../../utils/dashboard-api";

/** Proxy POST /v1/tenants/:id/products. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const item = await apiCreateCollectionItem(event, "products", getRouterParam(event, "id")!, body);
  setResponseStatus(event, 201);
  return item;
});
