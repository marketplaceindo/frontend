<script setup lang="ts">
import type { Tenant, TenantStatus } from "@marketplaceindo/shared";
import DashboardShell from "./DashboardShell.vue";

const { user } = useAuth();
const { listTenants } = useTenants();
const config = useRuntimeConfig();

const { data, error } = await useAsyncData("dashboard-tenants", () =>
  listTenants().then((r) => r.items),
);
const tenants = computed<Tenant[]>(() => data.value ?? []);

const STATUS_LABEL: Record<TenantStatus, { text: string; class: string }> = {
  draft: { text: "Belum terbit", class: "bg-amber-100 text-amber-800" },
  active: { text: "Online", class: "bg-teal-100 text-teal-800" },
  suspended: { text: "Dinonaktifkan", class: "bg-red-100 text-red-800" },
};

/**
 * URL situs tenant di lingkungan saat ini. Diturunkan dari URL request
 * (bukan `window`) supaya SSR dan klien menghasilkan string yang sama —
 * di dev ikut membawa port, mis. `http://warungbudi.lvh.me:3000`.
 */
const requestUrl = useRequestURL();
function siteUrl(tenant: Tenant): string {
  if (!tenant.subdomain) return "";
  const port = requestUrl.port ? `:${requestUrl.port}` : "";
  return `${requestUrl.protocol}//${tenant.subdomain}.${config.public.baseDomain}${port}`;
}
</script>

<template>
  <DashboardShell>
    <h1 class="text-xl font-bold">Halo, {{ user?.name }} 👋</h1>
    <p class="mt-1 text-sm text-slate-500">Kelola situs usahamu dari sini.</p>

    <p v-if="error" class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      Gagal memuat daftar situs. Muat ulang halaman untuk mencoba lagi.
    </p>

    <!-- Belum punya situs → satu jalur jelas ke wizard -->
    <section
      v-else-if="!tenants.length"
      class="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center"
    >
      <p class="font-medium">Kamu belum punya situs</p>
      <p class="mt-1 text-sm text-slate-500">
        Buat situs usaha dalam beberapa menit — jawab beberapa pertanyaan, situs
        langsung jadi.
      </p>
      <NuxtLink
        to="/onboarding"
        class="mt-4 inline-block rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
      >
        Mulai buat situs
      </NuxtLink>
    </section>

    <template v-else>
      <ul class="mt-6 space-y-3">
        <li
          v-for="tenant in tenants"
          :key="tenant.id"
          class="rounded-xl border border-slate-200 bg-white p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate font-semibold text-slate-900">
                {{ tenant.subdomain ?? "Situs baru" }}
              </p>
              <p class="mt-0.5 truncate text-xs text-slate-500">
                {{ tenant.subdomain ? `${tenant.subdomain}.${config.public.baseDomain}` : "Alamat belum dipilih" }}
              </p>
            </div>
            <span
              class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
              :class="STATUS_LABEL[tenant.status].class"
            >
              {{ STATUS_LABEL[tenant.status].text }}
            </span>
          </div>

          <div class="mt-4 flex gap-2">
            <NuxtLink
              v-if="tenant.subdomain"
              :to="{ path: '/editor', query: { tenant: tenant.id } }"
              class="flex-1 rounded-lg bg-teal-600 py-2.5 text-center text-sm font-semibold text-white"
            >
              Kelola isi situs
            </NuxtLink>
            <NuxtLink
              v-else
              to="/onboarding"
              class="flex-1 rounded-lg bg-teal-600 py-2.5 text-center text-sm font-semibold text-white"
            >
              Lanjutkan pengaturan
            </NuxtLink>
            <a
              v-if="tenant.status === 'active' && tenant.subdomain"
              :href="siteUrl(tenant)"
              target="_blank"
              rel="noopener"
              class="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-medium"
            >
              Lihat situs
            </a>
            <NuxtLink
              v-else-if="tenant.subdomain"
              to="/onboarding"
              class="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-medium"
            >
              Terbitkan
            </NuxtLink>
          </div>

          <NuxtLink
            :to="{ path: '/langganan', query: { tenant: tenant.id } }"
            class="mt-2 block py-2 text-center text-sm text-slate-500"
          >
            Langganan &amp; tagihan
          </NuxtLink>
        </li>
      </ul>

      <NuxtLink
        to="/onboarding"
        class="mt-4 block rounded-lg border border-dashed border-slate-300 py-3 text-center text-sm font-medium text-slate-600"
      >
        + Buat situs lain
      </NuxtLink>
    </template>
  </DashboardShell>
</template>
