import { apiSubscribe } from "../../utils/dashboard-api";

/** Proxy POST /v1/billing/subscribe — terbitkan invoice Xendit untuk plan pilihan. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const result = await apiSubscribe(event, body);
  setResponseStatus(event, 201);
  return result;
});
