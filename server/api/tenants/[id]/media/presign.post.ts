import { apiPresignMedia } from "../../../../utils/dashboard-api";

/**
 * Proxy POST /v1/tenants/:id/media/presign — klien meng-upload langsung ke
 * `uploadUrl` (PUT), lalu memakai `fileUrl` di block. Di mode mock keduanya
 * menunjuk route lokal `/api/media/:mediaId`.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const body = await readBody(event);
  const result = await apiPresignMedia(event, id, body);
  setResponseStatus(event, 201);
  return result;
});
