import { apiMockCheckout } from "../../utils/dashboard-api";

/** Detail invoice untuk halaman checkout simulasi (hanya mode mock). */
export default defineEventHandler((event) => {
  const id = String(getQuery(event).invoice ?? "");
  return apiMockCheckout(event, id);
});
