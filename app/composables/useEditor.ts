import type {
  Block,
  Page,
  PageDetailResponse,
  PresignResponse,
  Product,
  Section,
  SectionStyle,
  TemplateDetailResponse,
  Tenant,
  TenantTheme,
  VehicleModel,
  VehicleUnit,
} from "@marketplaceindo/shared";

interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Aksi editor konten (Fase 7c) — semua lewat proxy Nitro; browser tidak pernah
 * memanggil NestJS langsung. Endpoint mengikuti kontrak §4–§7: modul content
 * selalu bekerja pada **draft**, jadi perubahan baru terlihat publik setelah
 * Publish (sebelum itu hanya lewat `?preview=1`).
 */
export function useEditor() {
  const fetchApi = useRequestFetch();

  // --- Halaman ---------------------------------------------------------
  const listPages = (tenantId: string) =>
    fetchApi<{ items: Page[] }>(`/api/tenants/${tenantId}/pages`);

  const createPage = (tenantId: string, body: { slug: string; title: string }) =>
    fetchApi<Page>(`/api/tenants/${tenantId}/pages`, { method: "POST", body });

  const getPage = (pageId: string) => fetchApi<PageDetailResponse>(`/api/pages/${pageId}`);

  const updatePage = (pageId: string, body: Partial<Pick<Page, "title" | "seoJson">>) =>
    fetchApi<Page>(`/api/pages/${pageId}`, { method: "PATCH", body });

  const deletePage = (pageId: string) =>
    fetchApi(`/api/pages/${pageId}`, { method: "DELETE" });

  // --- Section & block -------------------------------------------------
  const updateSection = (
    pageId: string,
    sectionId: string,
    body: { enabled?: boolean; order?: number; styleJson?: SectionStyle },
  ) =>
    fetchApi<Section>(`/api/pages/${pageId}/sections/${sectionId}`, { method: "PATCH", body });

  const saveBlocks = (pageId: string, sectionId: string, blocks: Block[]) =>
    fetchApi<{ blocks: Block[] }>(`/api/pages/${pageId}/sections/${sectionId}/blocks`, {
      method: "PUT",
      body: { blocks },
    });

  // --- Tema & template -------------------------------------------------
  const updateTheme = (tenantId: string, theme: TenantTheme) =>
    fetchApi<Tenant>(`/api/tenants/${tenantId}/theme`, { method: "PATCH", body: theme });

  const templateDetail = (slug: string) =>
    fetchApi<TemplateDetailResponse>(`/api/templates/${slug}`);

  // --- Koleksi ---------------------------------------------------------
  const listVehicles = (tenantId: string, query: Record<string, unknown> = {}) =>
    fetchApi<Paginated<VehicleUnit>>(`/api/tenants/${tenantId}/vehicles`, { query });

  const listProducts = (tenantId: string, query: Record<string, unknown> = {}) =>
    fetchApi<Paginated<Product>>(`/api/tenants/${tenantId}/products`, { query });

  const createVehicle = (tenantId: string, body: Record<string, unknown>) =>
    fetchApi<VehicleUnit>(`/api/tenants/${tenantId}/vehicles`, { method: "POST", body });

  const createProduct = (tenantId: string, body: Record<string, unknown>) =>
    fetchApi<Product>(`/api/tenants/${tenantId}/products`, { method: "POST", body });

  const updateVehicle = (id: string, body: Record<string, unknown>) =>
    fetchApi<VehicleUnit>(`/api/vehicles/${id}`, { method: "PATCH", body });

  const updateProduct = (id: string, body: Record<string, unknown>) =>
    fetchApi<Product>(`/api/products/${id}`, { method: "PATCH", body });

  // --- Model kendaraan baru (kontrak §7.1) -----------------------------
  const listVehicleModels = (tenantId: string, query: Record<string, unknown> = {}) =>
    fetchApi<Paginated<VehicleModel>>(`/api/tenants/${tenantId}/vehicle-models`, { query });

  const createVehicleModel = (tenantId: string, body: Record<string, unknown>) =>
    fetchApi<VehicleModel>(`/api/tenants/${tenantId}/vehicle-models`, { method: "POST", body });

  const updateVehicleModel = (modelId: string, body: Record<string, unknown>) =>
    fetchApi<VehicleModel>(`/api/vehicle-models/${modelId}`, { method: "PATCH", body });

  const deleteVehicleModel = (modelId: string) =>
    fetchApi(`/api/vehicle-models/${modelId}`, { method: "DELETE" });

  const deleteVehicle = (id: string) => fetchApi(`/api/vehicles/${id}`, { method: "DELETE" });
  const deleteProduct = (id: string) => fetchApi(`/api/products/${id}`, { method: "DELETE" });

  /**
   * Upload gambar mengikuti kontrak §6: presign → PUT langsung ke `uploadUrl`
   * (object storage, bukan lewat API kita) → pakai `fileUrl` di block.
   */
  async function uploadImage(tenantId: string, file: File): Promise<{ mediaId: string; url: string }> {
    const presign = await fetchApi<PresignResponse>(`/api/tenants/${tenantId}/media/presign`, {
      method: "POST",
      body: { filename: file.name, mimeType: file.type, size: file.size },
    });
    await $fetch(presign.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    return { mediaId: presign.mediaId, url: presign.fileUrl };
  }

  return {
    listPages,
    createPage,
    getPage,
    updatePage,
    deletePage,
    updateSection,
    saveBlocks,
    updateTheme,
    templateDetail,
    listVehicles,
    listProducts,
    createVehicle,
    createProduct,
    updateVehicle,
    updateProduct,
    deleteVehicle,
    deleteProduct,
    listVehicleModels,
    createVehicleModel,
    updateVehicleModel,
    deleteVehicleModel,
    uploadImage,
  };
}
