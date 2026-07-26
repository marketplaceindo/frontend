<script setup lang="ts">
/**
 * Status langganan & riwayat invoice (Fase 7d; kontrak §9).
 * Presentasi plan selalu menonjolkan **tahunan sebagai hero** (setara 10 bulan,
 * hemat 17%) — keputusan terkunci. Kanal bayar yang ditampilkan mengikuti plan:
 * bulanan QRIS/e-wallet saja, tahunan semua kanal.
 *
 * Sumber kebenaran status = polling `GET /billing/status`; redirect dari kanal
 * bayar tidak pernah dianggap lunas.
 */
import {
  PLANS,
  type BillingStatusResponse,
  type PlanId,
  type Tenant,
} from "@marketplaceindo/shared";
import DashboardShell from "./DashboardShell.vue";

const route = useRoute();
const { listTenants, subscribe, billingStatus } = useTenants();

const tenantId = computed(() => String(route.query.tenant ?? ""));

const { data: tenants } = await useAsyncData("billing-tenants", () =>
  listTenants().then((r) => r.items),
);
const tenant = computed<Tenant | null>(
  () => tenants.value?.find((t) => t.id === tenantId.value) ?? tenants.value?.[0] ?? null,
);

const { data: status, refresh } = await useAsyncData<BillingStatusResponse | null>(
  () => `billing-status:${tenant.value?.id ?? ""}`,
  () => (tenant.value ? billingStatus(tenant.value.id) : Promise.resolve(null)),
  { watch: [tenant] },
);

const subscription = computed(() => status.value?.subscription ?? null);
const invoices = computed(() => status.value?.invoices ?? []);
const isActive = computed(() => subscription.value?.status === "active");

const CHANNEL_LABELS: Record<string, string> = {
  qris: "QRIS",
  ewallet: "e-wallet",
  va: "transfer bank",
  card: "kartu",
};

const yearlySaving = Math.round((1 - PLANS.yearly.price / (PLANS.monthly.price * 12)) * 100);

/** Peringatan jatuh tempo — aturannya di app/utils/billing.ts (teruji unit). */
const warning = computed(() => subscriptionWarning(subscription.value));
const formatDate = formatTanggal;

const STATUS_LABEL: Record<string, { text: string; class: string }> = {
  active: { text: "Aktif", class: "bg-teal-100 text-teal-800" },
  past_due: { text: "Tertunggak", class: "bg-red-100 text-red-800" },
  canceled: { text: "Berakhir", class: "bg-slate-200 text-slate-700" },
  none: { text: "Belum berlangganan", class: "bg-slate-200 text-slate-700" },
};

const INVOICE_LABEL: Record<string, { text: string; class: string }> = {
  paid: { text: "Lunas", class: "text-teal-700" },
  pending: { text: "Menunggu bayar", class: "text-amber-700" },
  expired: { text: "Kedaluwarsa", class: "text-slate-400" },
};

// --- Perpanjangan ----------------------------------------------------------
const busy = ref(false);
const message = ref("");
const invoiceUrl = ref("");
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let pollDeadline = 0;

async function pollStatus() {
  if (Date.now() > pollDeadline) {
    message.value = "Pembayaran belum terdeteksi. Kalau sudah membayar, tekan “Cek status”.";
    return;
  }
  await refresh();
  if (subscription.value?.status === "active" && !pendingInvoice.value) {
    message.value = "Pembayaran diterima — langganan diperpanjang.";
    invoiceUrl.value = "";
    return;
  }
  pollTimer = setTimeout(pollStatus, 4000);
}

const pendingInvoice = computed(() => invoices.value.find((i) => i.status === "pending") ?? null);

async function renew(plan: PlanId) {
  if (!tenant.value) return;
  busy.value = true;
  message.value = "";
  try {
    const invoice = await subscribe(tenant.value.id, plan);
    invoiceUrl.value = invoice.invoiceUrl;
    window.open(invoice.invoiceUrl, "_blank", "noopener");
    pollDeadline = Date.now() + 10 * 60 * 1000;
    message.value = "Menunggu pembayaran…";
    clearTimeout(pollTimer);
    pollTimer = setTimeout(pollStatus, 4000);
  } catch (err) {
    message.value = apiErrorOf(err).message;
  } finally {
    busy.value = false;
  }
}

async function checkNow() {
  message.value = "Mengecek…";
  pollDeadline = Date.now() + 10 * 60 * 1000;
  clearTimeout(pollTimer);
  await pollStatus();
}

onBeforeUnmount(() => clearTimeout(pollTimer));

const plansOrdered = [PLANS.yearly, PLANS.monthly];
</script>

<template>
  <DashboardShell>
    <NuxtLink to="/" class="text-sm text-slate-500">&larr; Dashboard</NuxtLink>
    <h1 class="mt-2 text-xl font-bold">Langganan</h1>

    <div v-if="!tenant" class="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
      <p class="text-sm text-slate-600">Belum ada situs. Buat situs dulu untuk mulai berlangganan.</p>
      <NuxtLink to="/onboarding" class="mt-3 inline-block text-sm font-semibold text-teal-700">
        Buat situs
      </NuxtLink>
    </div>

    <template v-else>
      <p class="mt-1 text-sm text-slate-500">{{ tenant.subdomain }}</p>

      <!-- Peringatan jatuh tempo / tertunggak -->
      <p
        v-if="warning"
        class="mt-4 rounded-lg px-3 py-2.5 text-sm"
        :class="warning.tone === 'danger' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'"
      >
        {{ warning.text }}
      </p>

      <!-- Status berjalan -->
      <section class="mt-4 rounded-xl border border-slate-200 bg-white p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm text-slate-500">Paket saat ini</p>
            <p class="mt-0.5 text-lg font-bold text-slate-900">
              {{ subscription ? PLANS[subscription.plan].label : "Belum berlangganan" }}
            </p>
          </div>
          <span
            class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
            :class="STATUS_LABEL[subscription?.status ?? 'none']!.class"
          >
            {{ STATUS_LABEL[subscription?.status ?? "none"]!.text }}
          </span>
        </div>

        <dl v-if="subscription" class="mt-4 space-y-1.5 text-sm">
          <div class="flex justify-between">
            <dt class="text-slate-500">Berlaku sampai</dt>
            <dd class="font-medium">{{ formatDate(subscription.periodEnd) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Biaya</dt>
            <dd class="font-medium">
              {{ formatRupiah(PLANS[subscription.plan].price) }}
              /{{ subscription.plan === "yearly" ? "tahun" : "bulan" }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Metode bayar</dt>
            <dd class="text-right font-medium">
              {{ PLANS[subscription.plan].channels.map((c) => CHANNEL_LABELS[c] ?? c).join(", ") }}
            </dd>
          </div>
        </dl>
      </section>

      <!-- Menunggu pembayaran -->
      <section v-if="pendingInvoice || invoiceUrl" class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p class="text-sm font-medium text-amber-900">Ada tagihan menunggu pembayaran</p>
        <p v-if="message" class="mt-1 text-sm text-amber-800">{{ message }}</p>
        <div class="mt-3 flex gap-2">
          <a
            :href="invoiceUrl || pendingInvoice?.invoiceUrl"
            target="_blank"
            rel="noopener"
            class="flex-1 rounded-lg bg-teal-600 py-2.5 text-center text-sm font-semibold text-white"
          >
            Bayar sekarang
          </a>
          <button
            type="button"
            class="rounded-lg border border-amber-300 px-4 py-2.5 text-sm font-medium"
            @click="checkNow"
          >
            Cek status
          </button>
        </div>
      </section>

      <p
        v-else-if="message"
        class="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700"
      >
        {{ message }}
      </p>

      <!-- Pilihan paket: tahunan selalu hero -->
      <h2 class="mt-6 text-lg font-bold text-slate-900">
        {{ isActive ? "Perpanjang lebih awal" : "Pilih paket" }}
      </h2>
      <div class="mt-3 space-y-3">
        <div
          v-for="plan in plansOrdered"
          :key="plan.id"
          class="rounded-xl border-2 bg-white p-5"
          :class="plan.hero ? 'border-teal-600' : 'border-slate-200'"
        >
          <p class="flex items-center gap-2 font-semibold text-slate-900">
            {{ plan.label }}
            <span
              v-if="plan.hero"
              class="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-semibold text-white"
            >
              Hemat {{ yearlySaving }}%
            </span>
          </p>
          <p class="mt-1 text-2xl font-bold text-slate-900">
            {{ formatRupiah(plan.price) }}
            <span class="text-sm font-normal text-slate-500">
              /{{ plan.id === "yearly" ? "tahun" : "bulan" }}
            </span>
          </p>
          <p v-if="plan.hero" class="mt-1 text-sm text-teal-700">
            Setara 10 bulan — bayar sekali untuk setahun penuh.
          </p>
          <p class="mt-2 text-xs text-slate-500">
            Bayar via {{ plan.channels.map((c) => CHANNEL_LABELS[c] ?? c).join(", ") }}.
          </p>

          <!--
            Kontrak §9 menolak subscribe saat langganan masih aktif
            (409 SUBSCRIPTION_ALREADY_ACTIVE), jadi tombol hanya aktif ketika
            langganan tidak aktif. Pindah paket saat masih aktif ditandai sebagai
            keputusan yang menunggu penambahan endpoint di kontrak.
          -->
          <button
            v-if="!isActive"
            type="button"
            :disabled="busy"
            class="mt-4 w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50"
            :class="plan.hero ? 'bg-teal-600 text-white' : 'border border-slate-300 bg-white'"
            @click="renew(plan.id)"
          >
            {{ busy ? "Memproses…" : `Pilih ${plan.label}` }}
          </button>
          <p
            v-else-if="subscription && plan.id !== subscription.plan && plan.hero"
            class="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600"
          >
            Bisa dipilih saat perpanjangan berikutnya ({{ formatDate(subscription.periodEnd) }}).
          </p>
          <p
            v-else-if="subscription && plan.id === subscription.plan"
            class="mt-4 text-center text-xs font-medium text-teal-700"
          >
            Paket kamu saat ini
          </p>
        </div>
      </div>

      <!-- Riwayat invoice -->
      <h2 class="mt-6 text-lg font-bold text-slate-900">Riwayat tagihan</h2>
      <p v-if="!invoices.length" class="mt-2 text-sm text-slate-500">Belum ada tagihan.</p>
      <ul v-else class="mt-3 space-y-2">
        <li
          v-for="invoice in invoices"
          :key="invoice.id"
          class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
        >
          <div class="min-w-0">
            <p class="font-medium text-slate-900">{{ formatRupiah(invoice.amount) }}</p>
            <p class="text-xs text-slate-500">
              {{ invoice.paidAt ? `Dibayar ${formatDate(invoice.paidAt)}` : "Belum dibayar" }}
            </p>
          </div>
          <span class="shrink-0 text-sm font-medium" :class="INVOICE_LABEL[invoice.status]!.class">
            {{ INVOICE_LABEL[invoice.status]!.text }}
          </span>
        </li>
      </ul>
    </template>
  </DashboardShell>
</template>
