import { apiReadMedia } from "../../utils/dashboard-api";

/** Berdiri untuk CDN object storage (mode mock): sajikan file yang di-upload. */
export default defineEventHandler((event) => {
  const mediaId = getRouterParam(event, "mediaId")!;
  const { bytes, mimeType } = apiReadMedia(mediaId);
  setResponseHeader(event, "Content-Type", mimeType);
  setResponseHeader(event, "Cache-Control", "public, max-age=31536000, immutable");
  return bytes;
});
