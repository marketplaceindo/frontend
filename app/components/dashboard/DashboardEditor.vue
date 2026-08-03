<script setup lang="ts">
/**
 * Editor konten (Fase 7c) — mobile-first, target utama Android Chrome.
 * Navigasi lewat query param (`?tenant=&tab=&page=`) supaya tombol Back HP
 * bekerja alami dan tiap layar bisa dibagikan/di-refresh.
 *
 * Model draft: semua perubahan di sini masuk ke draft; pengunjung situs baru
 * melihatnya setelah Publish (kontrak §5).
 */
import type { City, PageDetailResponse, Tenant, TenantTheme } from "@marketplaceindo/shared";
import { salesModeIncludes } from "@marketplaceindo/shared";
import DashboardShell from "./DashboardShell.vue";
import EditorSection from "./EditorSection.vue";
import EditorTheme from "./EditorTheme.vue";
import EditorCollections from "./EditorCollections.vue";
import EditorVehicleModels from "./EditorVehicleModels.vue";
import EditorPreview from "./EditorPreview.vue";

const route = useRoute();
const config = useRuntimeConfig();
const { listTenants, publish } = useTenants();
const { listPages, getPage, createPage, deletePage, updatePage } = useEditor();

const tenantId = computed(() => String(route.query.tenant ?? ""));
const tab = computed(() => String(route.query.tab ?? "halaman"));
const pageId = computed(() => String(route.query.page ?? ""));

const requestUrl = useRequestURL();

// --- Tenant ----------------------------------------------------------------
const { data: tenants, refresh: refreshTenants } = await useAsyncData("editor-tenants", () =>
  listTenants().then((r) => r.items),
);
const tenant = computed<Tenant | null>(
  () => tenants.value?.find((t) => t.id === tenantId.value) ?? tenants.value?.[0] ?? null,
);

/** URL situs tenant di lingkungan saat ini (dev ikut membawa port). */
function siteOrigin(subdomain: string): string {
  const port = requestUrl.port ? `:${requestUrl.port}` : "";
  return `${requestUrl.protocol}//${subdomain}.${config.public.baseDomain}${port}`;
}
const previewUrl = computed(() =>
  tenant.value?.subdomain ? `${siteOrigin(tenant.value.subdomain)}/?preview=1` : "",
);

// --- Halaman ---------------------------------------------------------------
const { data: pages, refresh: refreshPages } = await useAsyncData(
  () => `editor-pages:${tenantId.value}`,
  () => (tenant.value ? listPages(tenant.value.id).then((r) => r.items) : Promise.resolve([])),
  { watch: [tenant] },
);

const { data: pageDetail, refresh: refreshPage } = await useAsyncData<PageDetailResponse | null>(
  () => `editor-page:${pageId.value}`,
  () => (pageId.value ? getPage(pageId.value) : Promise.resolve(null)),
  { watch: [pageId] },
);

const sections = computed(() =>
  [...(pageDetail.value?.sections ?? [])].sort((a, b) => a.order - b.order),
);

/** Muat ulang iframe preview setelah menyimpan (draft berubah). */
const previewKey = ref(0);
async function onContentChanged() {
  await Promise.all([refreshPage(), refreshPages()]);
  previewKey.value++;
}

// --- Aksi halaman ----------------------------------------------------------
const newPage = reactive({ open: false, title: "", slug: "", error: "" });

async function submitNewPage() {
  newPage.error = "";
  if (!tenant.value) return;
  try {
    const page = await createPage(tenant.value.id, {
      slug: normalizeSubdomain(newPage.slug || newPage.title),
      title: newPage.title,
    });
    newPage.open = false;
    newPage.title = "";
    newPage.slug = "";
    await refreshPages();
    await navigateTo({ query: { ...route.query, page: page.id } });
  } catch (err) {
    newPage.error = apiErrorOf(err).message;
  }
}

async function removePage(id: string, title: string) {
  if (!confirm(`Hapus halaman "${title}"?`)) return;
  try {
    await deletePage(id);
    await refreshPages();
    if (pageId.value === id) await navigateTo({ query: { tenant: tenantId.value } });
  } catch (err) {
    newPage.error = apiErrorOf(err).message;
  }
}

// --- SEO halaman -----------------------------------------------------------
const seo = reactive({ open: false, title: "", description: "", busy: false, message: "" });
watch(pageDetail, (detail) => {
  seo.title = detail?.page.seoJson?.title ?? "";
  seo.description = detail?.page.seoJson?.description ?? "";
});

async function saveSeo() {
  if (!pageDetail.value) return;
  seo.busy = true;
  seo.message = "";
  try {
    await updatePage(pageDetail.value.page.id, {
      seoJson: {
        ...(seo.title ? { title: seo.title } : {}),
        ...(seo.description ? { description: seo.description } : {}),
      },
    });
    seo.message = "Tersimpan.";
    await onContentChanged();
  } catch (err) {
    seo.message = apiErrorOf(err).message;
  } finally {
    seo.busy = false;
  }
}

// --- Publish ---------------------------------------------------------------
const publishState = reactive({ busy: false, message: "", url: "" });

async function onPublish() {
  if (!tenant.value) return;
  publishState.busy = true;
  publishState.message = "";
  try {
    const result = await publish(tenant.value.id);
    publishState.url = result.url;
    publishState.message = "Perubahan sudah tayang di situsmu.";
    await refreshTenants();
  } catch (err) {
    const e = apiErrorOf(err);
    publishState.message =
      e.code === "PAYWALL_REQUIRED"
        ? "Situs ini belum berlangganan — selesaikan pembayaran dulu di halaman onboarding."
        : e.message;
  } finally {
    publishState.busy = false;
  }
}

const TABS = computed(() => [
  { id: "halaman", label: "Halaman" },
  { id: "tampilan", label: "Tampilan" },
  // Tab "Unit baru" hanya relevan bagi tenant yang menjual kendaraan baru.
  ...(salesModeBaru.value ? [{ id: "unit-baru", label: "Unit baru" }] : []),
  { id: "koleksi", label: collectionKind.value === "vehicles" ? "Mobil bekas" : "Produk" },
]);

/** Tenant menjual kendaraan baru? (settingsJson.salesMode, keputusan D-01) */
const salesModeBaru = computed(() =>
  salesModeIncludes(tenant.value?.settingsJson?.salesMode ?? "baru", "baru"),
);

/** Daftar kota tenant untuk harga OTR — dari settings, bukan katalog (D-03). */
const cities = computed<City[]>(() => tenant.value?.settingsJson?.cities ?? []);

/** Koleksi mana yang relevan mengikuti template tenant. */
const collectionKind = computed<"vehicles" | "products">(() =>
  pages.value?.some((p) => p.slug === "mobil") || tenant.value?.templateId?.startsWith("e4d8")
    ? "vehicles"
    : "products",
);

function themeSaved(theme: TenantTheme) {
  if (tenant.value) tenant.value.themeJson = theme;
  previewKey.value++;
}
</script>

<template>
  <DashboardShell>
    <div v-if="!tenant" class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
      <p class="font-medium">Belum ada situs untuk diedit</p>
      <NuxtLink to="/onboarding" class="mt-3 inline-block text-sm font-semibold text-teal-700">
        Buat situs dulu
      </NuxtLink>
    </div>

    <template v-else>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <NuxtLink to="/" class="text-sm text-slate-500">&larr; Dashboard</NuxtLink>
          <h1 class="mt-1 truncate text-xl font-bold">{{ tenant.subdomain }}</h1>
          <p class="text-xs text-slate-500">
            {{ tenant.status === "active" ? "Online" : "Belum terbit" }} · perubahan tersimpan
            sebagai draft
          </p>
        </div>
        <button
          type="button"
          :disabled="publishState.busy"
          class="shrink-0 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          @click="onPublish"
        >
          {{ publishState.busy ? "Menerbitkan…" : "Terbitkan" }}
        </button>
      </div>

      <p
        v-if="publishState.message"
        class="mt-3 rounded-lg px-3 py-2 text-sm"
        :class="publishState.url ? 'bg-teal-50 text-teal-800' : 'bg-amber-50 text-amber-800'"
      >
        {{ publishState.message }}
        <a v-if="publishState.url" :href="publishState.url" target="_blank" rel="noopener" class="font-semibold underline">
          Lihat situs
        </a>
      </p>

      <!-- Tab -->
      <nav class="mt-5 flex gap-1 rounded-lg bg-slate-100 p-1" aria-label="Bagian editor">
        <NuxtLink
          v-for="t in TABS"
          :key="t.id"
          :to="{ query: { tenant: tenant.id, tab: t.id } }"
          class="flex-1 rounded-md py-2 text-center text-sm font-medium"
          :class="tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'"
        >
          {{ t.label }}
        </NuxtLink>
      </nav>

      <div class="mt-5">
        <!-- HALAMAN -->
        <template v-if="tab === 'halaman'">
          <!-- Daftar halaman -->
          <template v-if="!pageId">
            <ul class="space-y-2">
              <li
                v-for="page in pages"
                :key="page.id"
                class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <NuxtLink
                  :to="{ query: { tenant: tenant.id, tab: 'halaman', page: page.id } }"
                  class="min-w-0 flex-1"
                >
                  <span class="block truncate font-medium text-slate-900">{{ page.title }}</span>
                  <span class="block truncate text-xs text-slate-500">
                    /{{ page.slug === "home" ? "" : page.slug }}
                  </span>
                </NuxtLink>
                <button
                  v-if="page.slug !== 'home'"
                  type="button"
                  class="shrink-0 text-sm text-red-600"
                  @click="removePage(page.id, page.title)"
                >
                  Hapus
                </button>
                <span class="text-slate-300" aria-hidden="true">›</span>
              </li>
            </ul>

            <div v-if="newPage.open" class="mt-3 rounded-xl border border-slate-200 bg-white p-4">
              <label class="block">
                <span class="mb-1.5 block text-sm font-medium text-slate-700">Judul halaman</span>
                <input
                  v-model="newPage.title"
                  type="text"
                  placeholder="Tentang Kami"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
                />
              </label>
              <label class="mt-3 block">
                <span class="mb-1.5 block text-sm font-medium text-slate-700">
                  Alamat halaman <span class="font-normal text-slate-400">(opsional)</span>
                </span>
                <input
                  v-model="newPage.slug"
                  type="text"
                  :placeholder="normalizeSubdomain(newPage.title) || 'tentang-kami'"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
                />
              </label>
              <p v-if="newPage.error" class="mt-2 text-sm text-red-600">{{ newPage.error }}</p>
              <div class="mt-3 flex gap-2">
                <button
                  type="button"
                  :disabled="!newPage.title"
                  class="flex-1 rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  @click="submitNewPage"
                >
                  Tambah
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                  @click="newPage.open = false"
                >
                  Batal
                </button>
              </div>
            </div>
            <button
              v-else
              type="button"
              class="mt-3 w-full rounded-lg border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600"
              @click="newPage.open = true"
            >
              + Tambah halaman
            </button>
          </template>

          <!-- Section satu halaman -->
          <template v-else-if="pageDetail">
            <NuxtLink
              :to="{ query: { tenant: tenant.id, tab: 'halaman' } }"
              class="text-sm text-slate-500"
            >
              &larr; Semua halaman
            </NuxtLink>
            <h2 class="mt-2 text-lg font-bold">{{ pageDetail.page.title }}</h2>

            <EditorPreview
              v-if="previewUrl"
              :key="previewKey"
              :url="pageDetail.page.slug === 'home' ? previewUrl : `${previewUrl.replace('/?preview=1', '')}/${pageDetail.page.slug}?preview=1`"
            />

            <ul class="mt-4 space-y-2">
              <EditorSection
                v-for="(section, i) in sections"
                :key="section.id"
                :page-id="pageDetail.page.id"
                :tenant-id="tenant.id"
                :section="section"
                :is-first="i === 0"
                :is-last="i === sections.length - 1"
                @changed="onContentChanged"
              />
            </ul>

            <details class="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <summary class="cursor-pointer text-sm font-medium text-slate-700">
                SEO halaman ini
              </summary>
              <div class="mt-3 space-y-3">
                <label class="block">
                  <span class="mb-1.5 block text-sm text-slate-600">Judul di Google</span>
                  <input
                    v-model="seo.title"
                    type="text"
                    class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
                  />
                </label>
                <label class="block">
                  <span class="mb-1.5 block text-sm text-slate-600">Deskripsi singkat</span>
                  <textarea
                    v-model="seo.description"
                    rows="3"
                    class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
                  />
                </label>
                <p v-if="seo.message" class="text-sm text-slate-600">{{ seo.message }}</p>
                <button
                  type="button"
                  :disabled="seo.busy"
                  class="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  @click="saveSeo"
                >
                  Simpan SEO
                </button>
              </div>
            </details>
          </template>
        </template>

        <!-- TAMPILAN -->
        <template v-else-if="tab === 'tampilan'">
          <EditorTheme :tenant-id="tenant.id" :theme="tenant.themeJson" @saved="themeSaved" />
          <EditorPreview v-if="previewUrl" :key="`theme-${previewKey}`" :url="previewUrl" class="mt-4" />
        </template>

        <!-- UNIT BARU (model + varian) -->
        <template v-else-if="tab === 'unit-baru'">
          <EditorVehicleModels :tenant-id="tenant.id" :cities="cities" />
        </template>

        <!-- KOLEKSI -->
        <template v-else>
          <EditorCollections :tenant-id="tenant.id" :kind="collectionKind" />
        </template>
      </div>
    </template>
  </DashboardShell>
</template>
