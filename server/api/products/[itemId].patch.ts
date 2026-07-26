import { apiUpdateCollectionItem } from "../../utils/dashboard-api";

/** Proxy PATCH /v1/products/:productId. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  return apiUpdateCollectionItem(event, "products", getRouterParam(event, "itemId")!, body);
});
