import { apiStoreMedia } from "../../utils/dashboard-api";

/** Berdiri untuk PUT ke presigned URL object storage (mode mock). */
export default defineEventHandler(async (event) => {
  const mediaId = getRouterParam(event, "mediaId")!;
  const body = await readRawBody(event, false);
  apiStoreMedia(event, mediaId, new Uint8Array(body ?? []));
  setResponseStatus(event, 204);
  return null;
});
