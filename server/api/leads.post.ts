import { createLeadRequestSchema } from "@marketplaceindo/shared";
import { submitPublicLead } from "../utils/render-client";

/**
 * Form publik situs tenant → route ini → backend /v1/public/:subdomain/leads
 * (server-to-server). Browser tidak pernah menyentuh NestJS langsung.
 * Validasi server-side di sini = sisi kedua dari "tervalidasi dua arah";
 * error mengikuti format kontrak §1.4 (fieldErrors dot-notation).
 * TODO(backend Fase 9): rate limit per-IP+tenant & verifikasi Turnstile.
 */
export default defineEventHandler(async (event) => {
  const routing = event.context.tenant;
  if (!routing || routing.mode !== "tenant") {
    throw createError({ statusCode: 404, message: "Bukan situs tenant" });
  }

  const body = await readBody(event).catch(() => undefined);
  const parsed = createLeadRequestSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "_";
      (fieldErrors[path] ??= []).push(issue.message);
    }
    throw createError({
      statusCode: 422,
      message: "Data tidak valid",
      data: { error: { code: "VALIDATION_ERROR", message: "Data tidak valid", fieldErrors } },
    });
  }

  const result = await submitPublicLead(event, routing.subdomain, parsed.data);
  setResponseStatus(event, 201);
  return result;
});
