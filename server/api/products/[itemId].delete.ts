import { apiDeleteCollectionItem } from "../../utils/dashboard-api";

/** Proxy DELETE /v1/products/:productId → 204. */
export default defineEventHandler(async (event) => {
  await apiDeleteCollectionItem(event, "products", getRouterParam(event, "itemId")!);
  setResponseStatus(event, 204);
  return null;
});
