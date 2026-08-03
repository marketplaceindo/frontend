import { apiImportPrices } from "../../../../utils/dashboard-api";

/**
 * Unggah file harga (multipart, field `file`). Pencocokan by `variantId` dalam
 * scope tenant — varian milik tenant lain jadi `variant_not_found` (D-16).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const parts = await readMultipartFormData(event);
  const file = parts?.find((p) => p.name === "file" && p.data.length > 0);
  if (!file) {
    throw createError({
      statusCode: 422,
      message: "File tidak terkirim",
      data: { error: { code: "VALIDATION_ERROR", message: "Pilih file dulu" } },
    });
  }
  return apiImportPrices(event, id, { data: file.data, filename: file.filename ?? "harga" });
});
