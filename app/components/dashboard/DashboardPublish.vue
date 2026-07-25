<script setup lang="ts">
/**
 * Layar hasil wizard (Fase 7b tahap 4–5): preview situs yang sudah terisi
 * konten nyata, lalu **paywall di tombol Publish** — bukan sebelumnya.
 *
 * Alur bayar mengikuti kontrak §9: subscribe → buka invoiceUrl → poll
 * `GET /billing/status` sampai `subscription.status=active` → publish.
 * Redirect dari kanal bayar TIDAK PERNAH dianggap lunas.
 */
import { PLANS, type PlanId, type PlanInfo, type Tenant } from "@marketplaceindo/shared";

const props = defineProps<{
  tenant: Tenant;
  previewUrl: string;
  businessName: string;
}>();

const emit = defineEmits<{ updated: [Tenant] }>();

const { publish, subscribe, billingStatus } = useTenants();

type Phase = "preview" | "plans" | "waiting" | "live";
const phase = ref<Phase>(props.tenant.status === "active" ? "live" : "preview");
const busy = ref(false);
const message = ref("");
const liveUrl = ref("");
const plans = ref<PlanInfo[]>([]);
const invoiceUrl = ref("");
const pollNote = ref("");

const CHANNEL_LABELS: Record<string, string> = {
  qris: "QRIS",
  ewallet: "e-wallet",
  va: "transfer bank",
  card: "kartu",
};

/** Tombol Publish — 402 PAYWALL_REQUIRED membuka pemilihan plan. */
async function onPublish() {
  message.value = "";
  busy.value = true;
  try {
    const result = await publish(props.tenant.id);
    emit("updated", result.tenant);
    liveUrl.value = result.url;
    phase.value = "live";
  } catch (err) {
    const e = apiErrorOf(err);
    if (e.code === "PAYWALL_REQUIRED") {
      const detail = e.details?.plans as PlanInfo[] | undefined;
      // Fallback ke katalog plan shared bila backend tak mengirim details.
      plans.value = detail?.length ? detail : [PLANS.yearly, PLANS.monthly];
      phase.value = "plans";
    } else if (e.code === "CONTENT_INCOMPLETE") {
      const missing = (e.details?.missing as string[] | undefined) ?? [];
      message.value = missing.length
        ? `Situs belum lengkap: ${missing.join(", ")}.`
        : e.message;
    } else {
      message.value = e.message;
    }
  } finally {
    busy.value = false;
  }
}

let pollTimer: ReturnType<typeof setTimeout> | undefined;
let pollDeadline = 0;

/** Poll status pembayaran (kontrak §9: 3–5 detik, maksimal 10 menit). */
async function pollStatus() {
  if (Date.now() > pollDeadline) {
    pollNote.value =
      "Pembayaran belum terdeteksi. Kalau sudah membayar, tekan “Cek status pembayaran”.";
    return;
  }
  try {
    const status = await billingStatus(props.tenant.id);
    if (status.subscription?.status === "active") {
      pollNote.value = "Pembayaran diterima — menerbitkan situs…";
      await onPublish();
      return;
    }
  } catch {
    // Kegagalan sementara tidak menghentikan polling; deadline yang menghentikan.
  }
  pollTimer = setTimeout(pollStatus, 4000);
}

function startPolling() {
  clearTimeout(pollTimer);
  pollDeadline = Date.now() + 10 * 60 * 1000;
  pollNote.value = "Menunggu pembayaran…";
  pollTimer = setTimeout(pollStatus, 4000);
}

async function choosePlan(plan: PlanId) {
  message.value = "";
  busy.value = true;
  try {
    const invoice = await subscribe(props.tenant.id, plan);
    invoiceUrl.value = invoice.invoiceUrl;
    phase.value = "waiting";
    window.open(invoice.invoiceUrl, "_blank", "noopener");
    startPolling();
  } catch (err) {
    const e = apiErrorOf(err);
    if (e.code === "SUBSCRIPTION_ALREADY_ACTIVE") {
      await onPublish();
    } else {
      message.value = e.message;
    }
  } finally {
    busy.value = false;
  }
}

/** Cek manual — untuk user yang membayar di perangkat lain. */
async function checkNow() {
  pollNote.value = "Mengecek…";
  clearTimeout(pollTimer);
  pollDeadline = Date.now() + 10 * 60 * 1000;
  await pollStatus();
}

onBeforeUnmount(() => clearTimeout(pollTimer));

const yearlySaving = computed(() =>
  Math.round((1 - PLANS.yearly.price / (PLANS.monthly.price * 12)) * 100),
);
</script>

<template>
  <div>
    <!-- Situs sudah terbit -->
    <template v-if="phase === 'live'">
      <div class="rounded-xl border border-teal-200 bg-teal-50 p-5 text-center">
        <p class="text-2xl" aria-hidden="true">🎉</p>
        <h1 class="mt-2 text-xl font-bold text-slate-900">Situsmu sudah online!</h1>
        <p class="mt-1 text-sm text-slate-600">
          {{ businessName || tenant.subdomain }} kini bisa diakses siapa saja.
        </p>
        <a
          :href="liveUrl || `https://${tenant.subdomain}`"
          target="_blank"
          rel="noopener"
          class="mt-4 inline-block rounded-lg bg-teal-600 px-5 py-3 text-sm font-semibold text-white"
        >
          Buka situs saya
        </a>
        <p class="mt-3 break-all text-xs text-slate-500">{{ liveUrl }}</p>
      </div>
      <NuxtLink
        to="/"
        class="mt-4 block rounded-lg border border-slate-300 bg-white py-3 text-center text-sm font-medium"
      >
        Ke dashboard
      </NuxtLink>
    </template>

    <template v-else>
      <h1 class="text-xl font-bold text-slate-900">Situsmu sudah jadi 🎉</h1>
      <p class="mt-1 text-sm text-slate-600">
        Ini pratinjau situs {{ businessName }} — isinya sudah dari jawabanmu, bukan
        contoh. Terbitkan kapan pun kamu siap.
      </p>

      <!-- Pratinjau (draft → noindex, hanya bisa dilihat lewat ?preview=1) -->
      <div class="mt-4 overflow-hidden rounded-xl border border-slate-300 bg-white">
        <div class="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2">
          <span class="size-2.5 rounded-full bg-slate-300" />
          <span class="truncate text-xs text-slate-500">{{ tenant.subdomain }}</span>
        </div>
        <iframe
          v-if="previewUrl"
          :src="previewUrl"
          title="Pratinjau situs"
          loading="lazy"
          class="h-[60vh] w-full border-0 bg-white"
        />
      </div>
      <a
        v-if="previewUrl"
        :href="previewUrl"
        target="_blank"
        rel="noopener"
        class="mt-2 inline-block text-sm font-medium text-teal-700"
      >
        Buka pratinjau di tab baru ↗
      </a>

      <p v-if="message" class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ message }}
      </p>

      <!-- Paywall: muncul hanya setelah user menekan Publish -->
      <template v-if="phase === 'plans'">
        <h2 class="mt-6 text-lg font-bold text-slate-900">Pilih paket untuk menerbitkan</h2>
        <p class="mt-1 text-sm text-slate-600">
          Situsmu tetap tersimpan. Bayar sekali, situs langsung online.
        </p>
        <div class="mt-4 space-y-3">
          <div
            v-for="plan in plans"
            :key="plan.id"
            class="rounded-xl border-2 bg-white p-5"
            :class="plan.hero ? 'border-teal-600' : 'border-slate-200'"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
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
              </div>
            </div>
            <button
              type="button"
              :disabled="busy"
              class="mt-4 w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50"
              :class="plan.hero ? 'bg-teal-600 text-white' : 'border border-slate-300 bg-white'"
              @click="choosePlan(plan.id)"
            >
              Pilih {{ plan.label }}
            </button>
          </div>
        </div>
      </template>

      <!-- Menunggu konfirmasi pembayaran (sumber kebenaran = polling status) -->
      <template v-else-if="phase === 'waiting'">
        <div class="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 class="font-semibold text-slate-900">Selesaikan pembayaran</h2>
          <p class="mt-1 text-sm text-slate-600">{{ pollNote }}</p>
          <a
            :href="invoiceUrl"
            target="_blank"
            rel="noopener"
            class="mt-4 inline-block rounded-lg bg-teal-600 px-5 py-3 text-sm font-semibold text-white"
          >
            Buka halaman pembayaran
          </a>
          <button
            type="button"
            class="mt-3 w-full rounded-lg border border-slate-300 py-3 text-sm font-medium"
            @click="checkNow"
          >
            Cek status pembayaran
          </button>
        </div>
      </template>

      <!-- Tombol publish (titik paywall) -->
      <button
        v-else
        type="button"
        :disabled="busy"
        class="mt-6 w-full rounded-lg bg-teal-600 px-4 py-3.5 text-base font-semibold text-white disabled:opacity-50"
        @click="onPublish"
      >
        {{ busy ? "Memproses…" : "Terbitkan situs" }}
      </button>

      <NuxtLink
        v-if="phase === 'preview'"
        to="/"
        class="mt-3 block py-2 text-center text-sm text-slate-500"
      >
        Nanti saja, simpan dulu
      </NuxtLink>
    </template>
  </div>
</template>
