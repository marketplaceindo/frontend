<script setup lang="ts">
/**
 * Wizard onboarding (Fase 7b) — alur "coba dulu → bayar saat publish".
 * Enam pertanyaan berbahasa manusia, BUKAN editor: nama usaha, jenis usaha,
 * kontak, jam buka, 3 andalan, alamat situs. Jawabannya dimaterialisasi jadi
 * situs berisi konten nyata, lalu langsung ditampilkan sebagai preview.
 * Paywall baru muncul di tombol Publish (keputusan terkunci CLAUDE.md).
 *
 * Mobile-first: satu pertanyaan per layar, tombol lanjut lebar penuh dan
 * menempel di bawah — target utama Android Chrome.
 */
import {
  BUSINESS_TYPES,
  wizardAnswersSchema,
  type BusinessType,
  type CheckSubdomainResponse,
  type Tenant,
  type WizardAnswers,
} from "@marketplaceindo/shared";
import { MIN_SUBDOMAIN_LENGTH, normalizeSubdomain } from "~~/shared/utils/subdomain";
import DashboardShell from "./DashboardShell.vue";
import WizardField from "./WizardField.vue";
import DashboardPublish from "./DashboardPublish.vue";

const {
  listTenants,
  createTenant,
  checkSubdomain,
  setSubdomain,
  runWizard,
} = useTenants();

const config = useRuntimeConfig();

/** Pilihan jenis usaha — menentukan template & konten yang dimaterialisasi. */
const BUSINESS_LABELS: Record<BusinessType, { label: string; example: string; icon: string }> = {
  kuliner: { label: "Kuliner", example: "warung, kafe, katering", icon: "🍜" },
  katalog: { label: "Toko / Produk", example: "toko online, reseller, UMKM", icon: "🛍️" },
  bisnis_jasa: { label: "Jasa", example: "servis, konsultan, kontraktor", icon: "🔧" },
  otomotif: { label: "Otomotif", example: "dealer mobil/motor, showroom", icon: "🚗" },
};

const TOTAL_STEPS = 6;
const step = ref(0);
const tenant = ref<Tenant | null>(null);
const bootError = ref("");
const busy = ref(false);
const errors = ref<Record<string, string>>({});

// Jawaban wizard (bentuk longgar; divalidasi per langkah dengan schema shared).
const form = reactive({
  businessName: "",
  tagline: "",
  businessType: "" as BusinessType | "",
  address: "",
  whatsapp: "",
  showHours: false,
  openingHours: [{ days: "Senin–Minggu", open: "08:00", close: "21:00" }],
  highlights: [{ name: "", price: "" }] as { name: string; price: string }[],
});

const subdomain = ref("");
const subdomainState = ref<"idle" | "checking" | "ok" | "bad">("idle");
const subdomainCheck = ref<CheckSubdomainResponse | null>(null);
const previewUrl = ref("");

/**
 * Siapkan draft tenant begitu wizard dibuka. Draft yang belum jadi dipakai ulang
 * supaya membuka wizard berkali-kali tidak menabrak batas draft per user.
 */
onMounted(async () => {
  try {
    const { items } = await listTenants();
    tenant.value = items.find((t) => t.status === "draft") ?? (await createTenant());
  } catch (err) {
    bootError.value = apiErrorOf(err).message;
  }
});

// --- Validasi per langkah -------------------------------------------------

/** Nomor WA Indonesia: 08xx / +62xx / 62xx → 62xx (format kontrak). */
function normalizeWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

/** Validasi sebagian jawaban dengan schema shared (tanpa mendefinisikan ulang). */
function validate(fields: Partial<Record<keyof WizardAnswers, true>>, value: unknown): boolean {
  const result = wizardAnswersSchema.pick(fields as never).safeParse(value);
  errors.value = result.success ? {} : zodFieldErrors(result.error.issues);
  return result.success;
}

const highlightsPayload = computed(() =>
  form.highlights
    .filter((h) => h.name.trim())
    .map((h) => ({
      name: h.name.trim(),
      ...(h.price.trim() ? { price: Number(h.price.replace(/\D/g, "")) } : {}),
    })),
);

const answers = computed<WizardAnswers>(() => ({
  businessName: form.businessName.trim(),
  businessType: form.businessType as BusinessType,
  address: form.address.trim(),
  whatsapp: normalizeWhatsapp(form.whatsapp),
  ...(form.showHours ? { openingHours: form.openingHours } : {}),
  highlights: highlightsPayload.value,
  ...(form.tagline.trim() ? { tagline: form.tagline.trim() } : {}),
}));

function nextStep() {
  errors.value = {};
  const a = answers.value;
  switch (step.value) {
    case 0:
      if (!validate({ businessName: true, tagline: true }, a)) return;
      break;
    case 1:
      if (!form.businessType) {
        errors.value = { businessType: "Pilih jenis usahamu" };
        return;
      }
      // Kuliner hampir selalu perlu jam buka — nyalakan sebagai default cerdas.
      form.showHours = form.businessType === "kuliner";
      break;
    case 2:
      form.whatsapp = normalizeWhatsapp(form.whatsapp);
      if (!validate({ address: true, whatsapp: true }, a)) return;
      break;
    case 3:
      if (form.showHours && !validate({ openingHours: true }, a)) return;
      break;
    case 4:
      if (!validate({ highlights: true }, a)) return;
      break;
  }
  step.value++;
  if (step.value === 5 && !subdomain.value) {
    subdomain.value = normalizeSubdomain(form.businessName);
    void checkNow();
  }
}

function prevStep() {
  errors.value = {};
  if (step.value > 0) step.value--;
}

// --- Step 5: ketersediaan subdomain (debounced) ---------------------------

let checkTimer: ReturnType<typeof setTimeout> | undefined;
let checkSeq = 0;

async function checkNow() {
  const value = subdomain.value;
  if (value.length < MIN_SUBDOMAIN_LENGTH) {
    subdomainState.value = "idle";
    subdomainCheck.value = null;
    return;
  }
  const seq = ++checkSeq;
  subdomainState.value = "checking";
  try {
    const result = await checkSubdomain(value);
    if (seq !== checkSeq) return; // balasan usang — abaikan
    subdomainCheck.value = result;
    subdomainState.value = result.available ? "ok" : "bad";
  } catch (err) {
    if (seq !== checkSeq) return;
    subdomainCheck.value = null;
    subdomainState.value = "bad";
    errors.value = { subdomain: apiErrorOf(err).message };
  }
}

function onSubdomainInput(raw: string) {
  subdomain.value = normalizeSubdomain(raw);
  subdomainState.value = "idle";
  subdomainCheck.value = null;
  clearTimeout(checkTimer);
  checkTimer = setTimeout(checkNow, 400);
}

onBeforeUnmount(() => clearTimeout(checkTimer));

const SUBDOMAIN_REASONS: Record<NonNullable<CheckSubdomainResponse["reason"]>, string> = {
  TAKEN: "Alamat ini sudah dipakai situs lain.",
  RESERVED: "Alamat ini dipakai sistem, pilih yang lain.",
  INVALID_FORMAT: `Gunakan huruf kecil, angka, dan tanda hubung (minimal ${MIN_SUBDOMAIN_LENGTH} karakter).`,
};

const siteHost = computed(() => `${subdomain.value || "alamatmu"}.${config.public.baseDomain}`);

// --- Materialisasi situs ---------------------------------------------------

async function buildSite() {
  if (!tenant.value || subdomainState.value !== "ok") return;
  errors.value = {};
  busy.value = true;
  try {
    tenant.value = await setSubdomain(tenant.value.id, subdomain.value);
    const result = await runWizard(tenant.value.id, answers.value);
    tenant.value = result.tenant;
    previewUrl.value = result.previewUrl;
    step.value = TOTAL_STEPS; // layar hasil: preview + publish
  } catch (err) {
    const e = apiErrorOf(err);
    errors.value = e.fieldErrors
      ? Object.fromEntries(Object.entries(e.fieldErrors).map(([k, v]) => [k, v[0] ?? ""]))
      : { _: e.message };
  } finally {
    busy.value = false;
  }
}

function addHighlight() {
  if (form.highlights.length < 3) form.highlights.push({ name: "", price: "" });
}
function removeHighlight(i: number) {
  if (form.highlights.length > 1) form.highlights.splice(i, 1);
}
function addHours() {
  if (form.openingHours.length < 7) {
    form.openingHours.push({ days: "", open: "08:00", close: "21:00" });
  }
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";

const STEP_TITLES = [
  "Apa nama usahamu?",
  "Jenis usahanya apa?",
  "Di mana dan ke mana pelanggan menghubungi?",
  "Kapan kamu buka?",
  "Apa 3 andalanmu?",
  "Mau pakai alamat apa?",
];
</script>

<template>
  <DashboardShell>
    <!-- Layar hasil: situs sudah jadi → preview + publish (paywall di sini) -->
    <DashboardPublish
      v-if="step === TOTAL_STEPS && tenant"
      :tenant="tenant"
      :preview-url="previewUrl"
      :business-name="form.businessName"
      @updated="tenant = $event"
    />

    <template v-else>
      <div class="mb-6">
        <button
          v-if="step > 0"
          type="button"
          class="text-sm text-slate-500"
          @click="prevStep"
        >
          &larr; Kembali
        </button>
        <NuxtLink v-else to="/" class="text-sm text-slate-500">&larr; Batal</NuxtLink>

        <div class="mt-3 flex items-center gap-2">
          <div
            v-for="i in TOTAL_STEPS"
            :key="i"
            class="h-1.5 flex-1 rounded-full"
            :class="i - 1 <= step ? 'bg-teal-600' : 'bg-slate-200'"
          />
        </div>
        <p class="mt-2 text-xs text-slate-500">Langkah {{ step + 1 }} dari {{ TOTAL_STEPS }}</p>
        <h1 class="mt-3 text-xl font-bold text-slate-900">{{ STEP_TITLES[step] }}</h1>
      </div>

      <p v-if="bootError" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ bootError }}
      </p>
      <p v-if="errors._" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ errors._ }}
      </p>

      <form class="space-y-5" novalidate @submit.prevent="step === 5 ? buildSite() : nextStep()">
        <!-- 1. Nama usaha -->
        <template v-if="step === 0">
          <WizardField label="Nama usaha" :error="errors.businessName">
            <input
              v-model="form.businessName"
              type="text"
              autocomplete="organization"
              placeholder="Warung Budi"
              :class="inputClass"
            />
          </WizardField>
          <WizardField
            label="Slogan singkat"
            optional
            hint="Satu kalimat yang menggambarkan usahamu. Bisa diisi nanti."
            :error="errors.tagline"
          >
            <input
              v-model="form.tagline"
              type="text"
              placeholder="Masakan rumahan sejak 2010"
              :class="inputClass"
            />
          </WizardField>
        </template>

        <!-- 2. Jenis usaha → menentukan template -->
        <template v-else-if="step === 1">
          <p v-if="errors.businessType" class="text-sm text-red-600">{{ errors.businessType }}</p>
          <div class="grid gap-3">
            <button
              v-for="type in BUSINESS_TYPES"
              :key="type"
              type="button"
              class="flex items-center gap-3 rounded-xl border-2 bg-white p-4 text-left"
              :class="
                form.businessType === type
                  ? 'border-teal-600 ring-1 ring-teal-600'
                  : 'border-slate-200'
              "
              :aria-pressed="form.businessType === type"
              @click="form.businessType = type"
            >
              <span class="text-2xl" aria-hidden="true">{{ BUSINESS_LABELS[type].icon }}</span>
              <span>
                <span class="block font-semibold text-slate-900">
                  {{ BUSINESS_LABELS[type].label }}
                </span>
                <span class="block text-sm text-slate-500">
                  {{ BUSINESS_LABELS[type].example }}
                </span>
              </span>
            </button>
          </div>
        </template>

        <!-- 3. Alamat + WhatsApp -->
        <template v-else-if="step === 2">
          <WizardField label="Alamat usaha" :error="errors.address">
            <textarea
              v-model="form.address"
              rows="3"
              placeholder="Jl. Melati No. 5, Bandung"
              :class="inputClass"
            />
          </WizardField>
          <WizardField
            label="Nomor WhatsApp"
            hint="Boleh tulis 0812… — otomatis diubah ke format 62812…"
            :error="errors.whatsapp"
          >
            <input
              v-model="form.whatsapp"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="081234567890"
              :class="inputClass"
              @blur="form.whatsapp = normalizeWhatsapp(form.whatsapp)"
            />
          </WizardField>
        </template>

        <!-- 4. Jam buka (opsional) -->
        <template v-else-if="step === 3">
          <label class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <input v-model="form.showHours" type="checkbox" class="size-5 accent-teal-600" />
            <span class="text-sm font-medium text-slate-700">Tampilkan jam buka di situs</span>
          </label>

          <div v-if="form.showHours" class="space-y-3">
            <p v-if="errors.openingHours" class="text-sm text-red-600">{{ errors.openingHours }}</p>
            <div
              v-for="(row, i) in form.openingHours"
              :key="i"
              class="rounded-xl border border-slate-200 bg-white p-4"
            >
              <input
                v-model="row.days"
                type="text"
                placeholder="Senin–Jumat"
                :class="inputClass"
                :aria-label="`Hari baris ${i + 1}`"
              />
              <div class="mt-3 flex items-center gap-2">
                <input v-model="row.open" type="time" :class="inputClass" aria-label="Jam buka" />
                <span class="text-slate-400">–</span>
                <input v-model="row.close" type="time" :class="inputClass" aria-label="Jam tutup" />
              </div>
              <button
                v-if="form.openingHours.length > 1"
                type="button"
                class="mt-3 text-sm text-red-600"
                @click="form.openingHours.splice(i, 1)"
              >
                Hapus baris
              </button>
            </div>
            <button
              v-if="form.openingHours.length < 7"
              type="button"
              class="w-full rounded-lg border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600"
              @click="addHours"
            >
              + Tambah jadwal berbeda
            </button>
          </div>
          <p v-else class="text-sm text-slate-500">
            Tidak masalah — bagian jam buka akan dilewati dan bisa ditambahkan kapan saja.
          </p>
        </template>

        <!-- 5. 1–3 andalan -->
        <template v-else-if="step === 4">
          <p class="text-sm text-slate-500">
            Isi produk, menu, atau layanan yang paling sering dicari pelanggan. Minimal satu.
          </p>
          <p v-if="errors.highlights" class="text-sm text-red-600">{{ errors.highlights }}</p>
          <div
            v-for="(item, i) in form.highlights"
            :key="i"
            class="rounded-xl border border-slate-200 bg-white p-4"
          >
            <WizardField :label="`Andalan ${i + 1}`" :error="errors[`highlights.${i}.name`]">
              <input
                v-model="item.name"
                type="text"
                placeholder="Nasi Goreng Spesial"
                :class="inputClass"
              />
            </WizardField>
            <div class="mt-3">
              <WizardField label="Harga" optional :error="errors[`highlights.${i}.price`]">
                <div class="flex items-center gap-2">
                  <span class="text-sm text-slate-500">Rp</span>
                  <input
                    v-model="item.price"
                    type="text"
                    inputmode="numeric"
                    placeholder="25000"
                    :class="inputClass"
                  />
                </div>
              </WizardField>
            </div>
            <button
              v-if="form.highlights.length > 1"
              type="button"
              class="mt-3 text-sm text-red-600"
              @click="removeHighlight(i)"
            >
              Hapus
            </button>
          </div>
          <button
            v-if="form.highlights.length < 3"
            type="button"
            class="w-full rounded-lg border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600"
            @click="addHighlight"
          >
            + Tambah andalan
          </button>
        </template>

        <!-- 6. Alamat situs (subdomain) -->
        <template v-else-if="step === 5">
          <WizardField label="Alamat situs" :error="errors.subdomain">
            <div class="flex items-center rounded-lg border border-slate-300 bg-white pr-3">
              <input
                :value="subdomain"
                type="text"
                inputmode="url"
                autocapitalize="none"
                autocorrect="off"
                spellcheck="false"
                placeholder="warungbudi"
                class="w-full rounded-l-lg px-3 py-3 text-base text-slate-900 focus:outline-none"
                @input="onSubdomainInput(($event.target as HTMLInputElement).value)"
              />
              <span class="shrink-0 text-sm text-slate-500">.{{ config.public.baseDomain }}</span>
            </div>
          </WizardField>

          <p v-if="subdomainState === 'checking'" class="text-sm text-slate-500">
            Mengecek ketersediaan…
          </p>
          <p v-else-if="subdomainState === 'ok'" class="text-sm font-medium text-teal-700">
            ✓ {{ siteHost }} tersedia
          </p>
          <div v-else-if="subdomainState === 'bad' && subdomainCheck" class="space-y-2">
            <p class="text-sm text-red-600">
              {{ subdomainCheck.reason ? SUBDOMAIN_REASONS[subdomainCheck.reason] : "Tidak tersedia." }}
            </p>
            <div v-if="subdomainCheck.suggestions?.length" class="flex flex-wrap gap-2">
              <button
                v-for="s in subdomainCheck.suggestions"
                :key="s"
                type="button"
                class="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm"
                @click="((subdomain = s), checkNow())"
              >
                {{ s }}
              </button>
            </div>
          </div>

          <p class="text-xs text-slate-500">
            Boleh huruf kecil, angka, dan tanda hubung. Nama umum seperti
            <code>www</code> atau <code>admin</code> dipakai sistem.
          </p>
        </template>

        <button
          type="submit"
          :disabled="busy || !tenant || (step === 5 && subdomainState !== 'ok')"
          class="w-full rounded-lg bg-teal-600 px-4 py-3.5 text-base font-semibold text-white disabled:opacity-50"
        >
          <template v-if="busy">Membuat situs…</template>
          <template v-else-if="step === 5">Buat situs saya</template>
          <template v-else>Lanjut</template>
        </button>
      </form>
    </template>
  </DashboardShell>
</template>
