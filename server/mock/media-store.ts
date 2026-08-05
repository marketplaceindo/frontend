/**
 * Mock modul Media (Fase 7c; kontrak §6). Backend nyata menerbitkan presigned
 * URL ke object storage dan klien meng-upload langsung ke sana; mock meniru
 * bentuk yang sama — `uploadUrl` menunjuk route Nitro lokal yang menyimpan byte
 * di memori, `fileUrl` menunjuk route penyaji. Alur klien identik di kedua mode:
 * presign → PUT ke uploadUrl → pakai fileUrl.
 *
 * Bebas dependensi Nitro/h3 → bisa diuji unit murni.
 */
import { base64ToBytes, bytesToBase64, registerStore } from "./persist";
import {
  ALLOWED_MEDIA_MIME_TYPES,
  presignRequestSchema,
  type MediaMimeType,
  type PresignResponse,
} from "@marketplaceindo/shared";
import { TenantApiError } from "./api-error";

/** Batas ukuran mock (backend nyata: per plan). */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface StoredMedia {
  id: string;
  tenantId: string;
  mimeType: MediaMimeType;
  filename: string;
  /** Byte file; terisi setelah klien PUT ke uploadUrl. */
  bytes: Uint8Array | null;
}

const media = new Map<string, StoredMedia>();

/** POST /v1/tenants/:id/media/presign */
export function presignUpload(
  tenantId: string,
  raw: unknown,
  urls: (mediaId: string) => { uploadUrl: string; fileUrl: string },
): PresignResponse {
  const parsed = presignRequestSchema.safeParse(raw);
  if (!parsed.success) {
    // `mimeType` sudah dibatasi whitelist di schema shared; ubah jadi kode
    // khusus kontrak §6 supaya frontend bisa memberi pesan yang tepat, bukan
    // "VALIDATION_ERROR" generik.
    if (parsed.error.issues.some((issue) => issue.path[0] === "mimeType")) {
      throw new TenantApiError(
        422,
        "UNSUPPORTED_MEDIA_TYPE",
        `Format gambar harus ${ALLOWED_MEDIA_MIME_TYPES.map((m) => m.replace("image/", "").toUpperCase()).join(", ")}`,
      );
    }
    throw parsed.error;
  }
  const body = parsed.data;

  if (body.size > MAX_FILE_BYTES) {
    throw new TenantApiError(
      422,
      "FILE_TOO_LARGE",
      `Ukuran gambar maksimal ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB`,
    );
  }

  const mediaId = crypto.randomUUID();
  media.set(mediaId, {
    id: mediaId,
    tenantId,
    mimeType: body.mimeType,
    filename: body.filename,
    bytes: null,
  });
  return { mediaId, ...urls(mediaId) };
}

/** Terima byte upload (berdiri untuk PUT ke object storage). */
export function storeUpload(mediaId: string, bytes: Uint8Array): void {
  const entry = media.get(mediaId);
  if (!entry) throw new TenantApiError(404, "NOT_FOUND", "Media tidak ditemukan");
  if (bytes.byteLength > MAX_FILE_BYTES) {
    throw new TenantApiError(422, "FILE_TOO_LARGE", "Ukuran gambar melebihi batas");
  }
  entry.bytes = bytes;
}

/** Sajikan file (berdiri untuk CDN object storage). */
export function readUpload(mediaId: string): { bytes: Uint8Array; mimeType: string } {
  const entry = media.get(mediaId);
  if (!entry?.bytes) throw new TenantApiError(404, "NOT_FOUND", "Media tidak ditemukan");
  return { bytes: entry.bytes, mimeType: entry.mimeType };
}

/** Media milik tenant ini? (isolasi §1.5) */
export function mediaBelongsTo(mediaId: string, tenantId: string): boolean {
  return media.get(mediaId)?.tenantId === tenantId;
}

// --- Persistensi dev (lihat persist.ts) ------------------------------------
// Byte gambar ikut disimpan sebagai base64: tanpa itu foto yang baru diunggah
// user jadi tautan mati setiap dev server restart.
registerStore("media", {
  dump: () =>
    [...media.entries()].map(([id, m]) => [
      id,
      { ...m, bytes: m.bytes ? bytesToBase64(m.bytes) : null },
    ]),
  restore: (d: [string, Omit<StoredMedia, "bytes"> & { bytes: string | null }][]) => {
    media.clear();
    for (const [id, m] of d) {
      media.set(id, { ...m, bytes: m.bytes ? base64ToBytes(m.bytes) : null });
    }
  },
});
