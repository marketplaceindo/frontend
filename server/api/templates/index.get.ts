import { apiListTemplates } from "../../utils/dashboard-api";

/** Proxy GET /v1/templates — katalog template. */
export default defineEventHandler((event) => apiListTemplates(event));
