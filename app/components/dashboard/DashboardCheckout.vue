<script setup lang="ts">
/**
 * Checkout **simulasi** — pengganti halaman pembayaran Xendit selama backend
 * billing belum ada (mode `dashboardMock`). Menekan "Bayar" di sini setara
 * dengan webhook `invoice.paid`: langganan aktif → tenant auto-publish.
 * Di produksi halaman ini tidak ada; user dibawa ke checkout.xendit.co.
 */
import type { PlanId } from "@marketplaceindo/shared";
import DashboardShell from "./DashboardShell.vue";

interface MockInvoice {
  id: string;
  amount: number;
  status: "pending" | "paid" | "expired";
  plan: PlanId;
  expiresAt: string;
}

const route = useRoute();
const invoiceId = computed(() => String(route.query.invoice ?? ""));

const error = ref("");
const busy = ref(false);
const paid = ref(false);

// SSR: cookie sesi diteruskan lewat useRequestFetch, jadi tagihan sudah
// ter-render di HTML pertama (bukan menunggu hidrasi).
const fetchApi = useRequestFetch();
const { data: invoice } = await useAsyncData<MockInvoice | null>(
  () => `mock-invoice:${invoiceId.value}`,
  () =>
    fetchApi<MockInvoice>("/api/billing/mock-invoice", {
      query: { invoice: invoiceId.value },
    }).catch((err) => {
      error.value = apiErrorOf(err).message;
      return null;
    }),
);
paid.value = invoice.value?.status === "paid";

async function pay() {
  busy.value = true;
  error.value = "";
  try {
    await $fetch("/api/billing/mock-pay", {
      method: "POST",
      body: { invoiceId: invoiceId.value },
    });
    paid.value = true;
  } catch (err) {
    error.value = apiErrorOf(err).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <DashboardShell>
    <div class="mx-auto max-w-sm">
      <p class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Halaman pembayaran <strong>simulasi</strong> (mode pengembangan). Di produksi
        kamu akan diarahkan ke halaman pembayaran Xendit.
      </p>

      <p v-if="error" class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ error }}
      </p>

      <div v-if="paid" class="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-6 text-center">
        <p class="text-2xl" aria-hidden="true">✅</p>
        <h1 class="mt-2 font-bold text-slate-900">Pembayaran berhasil</h1>
        <p class="mt-1 text-sm text-slate-600">
          Silakan kembali ke tab sebelumnya — situsmu sedang diterbitkan.
        </p>
      </div>

      <div v-else-if="invoice" class="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h1 class="text-lg font-bold text-slate-900">Tagihan langganan</h1>
        <dl class="mt-4 space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-slate-500">Paket</dt>
            <dd class="font-medium">{{ invoice.plan === "yearly" ? "Tahunan" : "Bulanan" }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Jumlah</dt>
            <dd class="text-lg font-bold">{{ formatRupiah(invoice.amount) }}</dd>
          </div>
        </dl>
        <button
          type="button"
          :disabled="busy"
          class="mt-6 w-full rounded-lg bg-teal-600 px-4 py-3.5 font-semibold text-white disabled:opacity-50"
          @click="pay"
        >
          {{ busy ? "Memproses…" : "Bayar sekarang (simulasi)" }}
        </button>
      </div>
    </div>
  </DashboardShell>
</template>
