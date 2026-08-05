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
  POPULAR_RANK_MAX,
  MAX_SEED_MODELS,
  wizardAnswersSchema,
  type BusinessType,
  type CatalogBrandPublic,
  type CatalogCityPublic,
  type CatalogModelCard,
  type CheckSubdomainResponse,
  type SeedInventoryResult,
  type Tenant,
  type VehicleVertical,
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

/**
 * Step wizard sebagai daftar ber-ID, bukan angka mati: jalur otomotif menyisipkan
 * empat step katalog di tengah (D-13), dan jalur non-otomotif harus melewatinya
 * tanpa meninggalkan lubang di indikator progres.
 */
type StepId =
  | "nama"
  | "jenis"
  | "jual-apa"
  | "merk"
  | "kota"
  | "model"
  | "kontak"
  | "jam"
  | "andalan"
  | "subdomain";

/** Salinan teks step andalan — lihat app/utils/wizard-copy.ts. */
const andalanCopy = computed(() => andalanCopyFor(form.businessType));

const STEP_TITLES: Record<StepId, string> = {
  nama: "Apa nama usahamu?",
  jenis: "Jenis usahanya apa?",
  "jual-apa": "Kamu jual apa?",
  merk: "Merk apa yang kamu jual?",
  kota: "Kamu jualan di kota mana?",
  model: "Model apa saja yang kamu jual?",
  kontak: "Di mana dan ke mana pelanggan menghubungi?",
  jam: "Kapan kamu buka?",
  andalan: "Apa 3 andalanmu?",
  subdomain: "Mau pakai alamat apa?",
};

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
/** `true` setelah situs jadi — layar hasil menggantikan form wizard. */
const selesai = ref(false);
const seedWarningError = ref("");

// --- Katalog seed kendaraan baru (D-13) -----------------------------------

const { brands, cities, models, seedInventory } = useCatalog();

/** "Jual apa" menurunkan `salesMode` (D-01) sekaligus vertikal katalog. */
type JualApa = "mobil" | "motor" | "bekas" | "keduanya";

const JUAL_APA: { id: JualApa; label: string; hint: string; icon: string }[] = [
  { id: "mobil", label: "Mobil baru", hint: "dealer resmi, sales ATPM", icon: "🚗" },
  { id: "motor", label: "Motor baru", hint: "dealer motor", icon: "🏍️" },
  { id: "bekas", label: "Mobil bekas", hint: "showroom unit bekas", icon: "🔑" },
  { id: "keduanya", label: "Baru dan bekas", hint: "keduanya sekaligus", icon: "🚙" },
];

const jualApa = ref<JualApa | "">("");
const brandList = ref<CatalogBrandPublic[]>([]);
const cityList = ref<CatalogCityPublic[]>([]);
const modelList = ref<CatalogModelCard[]>([]);
const brandId = ref("");
const cityCode = ref("");
const modelDipilih = ref<string[]>([]);
const katalogBusy = ref(false);
const seedResult = ref<SeedInventoryResult | null>(null);

/**
 * Jalur `bekas` melewati SELURUH step katalog — showroom unit bekas tidak punya
 * padanan di katalog kendaraan baru, dan memaksanya lewat step merk/kota hanya
 * menambah waktu wizard tanpa menghasilkan satu record pun.
 */
const pakaiKatalog = computed(
  () => form.businessType === "otomotif" && (jualApa.value === "mobil" || jualApa.value === "motor"),
);

const vertical = computed<VehicleVertical>(() => (jualApa.value === "motor" ? "motor" : "mobil"));

const steps = computed<StepId[]>(() => {
  const dasar: StepId[] = ["nama", "jenis"];
  if (form.businessType === "otomotif") dasar.push("jual-apa");
  if (pakaiKatalog.value) dasar.push("merk", "kota", "model");
  return [...dasar, "kontak", "jam", "andalan", "subdomain"];
});

const stepId = computed<StepId>(() => steps.value[step.value] ?? "nama");
const langkahTerakhir = computed(() => step.value === steps.value.length - 1);

const kotaTerpilih = computed(() => cityList.value.find((c) => c.code === cityCode.value) ?? null);

/** Kota fallback yang akan dipakai bila kota pilihan tidak punya OTR sendiri. */
const kotaFallback = computed(() => {
  const kota = kotaTerpilih.value;
  if (!kota || kota.hasExactPrice) return null;
  const ibukota = cityList.value.find(
    (c) => c.provinceCode === kota.provinceCode && c.hasExactPrice && c.code !== kota.code,
  );
  return ibukota?.name ?? "harga nasional";
});

const modelTerpilih = computed(() =>
  modelList.value.filter((m) => modelDipilih.value.includes(m.id)),
);
const varianAkanDibuat = computed(() =>
  modelTerpilih.value.reduce((n, m) => n + m.variantCount, 0),
);
const terlaluBanyakModel = computed(() => modelDipilih.value.length > MAX_SEED_MODELS);

async function muatMerk() {
  katalogBusy.value = true;
  try {
    brandList.value = (await brands(vertical.value)).brands;
  } catch (err) {
    errors.value = { _: apiErrorOf(err).message };
  } finally {
    katalogBusy.value = false;
  }
}

async function muatKota() {
  katalogBusy.value = true;
  try {
    cityList.value = (await cities(vertical.value)).cities;
  } catch (err) {
    errors.value = { _: apiErrorOf(err).message };
  } finally {
    katalogBusy.value = false;
  }
}

/**
 * Prefetch begitu kota dipilih, jangan tunggu klik "lanjut" — keempat step
 * katalog punya anggaran ≤60 detik dari total wizard <5 menit.
 */
async function muatModel() {
  if (!brandId.value || !cityCode.value) return;
  katalogBusy.value = true;
  try {
    modelList.value = (await models(brandId.value, cityCode.value)).models;
    // Model populer tercentang otomatis: tanpa ini step pemilih model jadi
    // pekerjaan, bukan konfirmasi — dan itu drop-off terbesar wizard.
    modelDipilih.value = modelList.value
      .filter((m) => m.popularityRank <= POPULAR_RANK_MAX)
      .map((m) => m.id);
  } catch (err) {
    errors.value = { _: apiErrorOf(err).message };
  } finally {
    katalogBusy.value = false;
  }
}

function pilihJualApa(id: JualApa) {
  jualApa.value = id;
  trackEvent({ name: "wizard_vertical_selected", vertical: id });
}

function pilihMerk(brand: CatalogBrandPublic) {
  brandId.value = brand.id;
  trackEvent({ name: "wizard_brand_selected", brandSlug: brand.slug });
}

function pilihKota(kota: CatalogCityPublic) {
  cityCode.value = kota.code;
  trackEvent({
    name: "wizard_city_selected",
    cityCode: kota.code,
    hasExactPrice: kota.hasExactPrice,
  });
  void muatModel();
}

function toggleModel(id: string) {
  const i = modelDipilih.value.indexOf(id);
  if (i === -1) modelDipilih.value.push(id);
  else modelDipilih.value.splice(i, 1);
}

const semuaTercentang = computed(
  () => modelList.value.length > 0 && modelDipilih.value.length === modelList.value.length,
);

function toggleSemuaModel() {
  modelDipilih.value = semuaTercentang.value ? [] : modelList.value.map((m) => m.id);
}

/** Label warning seed dalam bahasa yang dimengerti sales, bukan istilah sistem. */
function labelWarning(w: NonNullable<SeedInventoryResult["warnings"]>[number]): string {
  switch (w.kind) {
    case "price_estimated":
      return `Harga ${w.modelSlug} kami isi dengan estimasi dari ${w.fromCity}. Periksa sebelum publikasi.`;
    case "variant_skipped_no_price":
      return `Varian ${w.variantSlug} (${w.modelSlug}) dilewati karena belum ada harganya.`;
    case "model_skipped_no_price":
      return `Model ${w.modelSlug} dilewati karena belum ada harganya sama sekali.`;
  }
}

/** Estimasi selalu jadi baris pertama — itu yang paling berisiko bila terlewat. */
const warningTerurut = computed(() =>
  [...(seedResult.value?.warnings ?? [])].sort(
    (a, b) => Number(b.kind === "price_estimated") - Number(a.kind === "price_estimated"),
  ),
);

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

async function nextStep() {
  errors.value = {};
  const a = answers.value;

  switch (stepId.value) {
    case "nama":
      if (!validate({ businessName: true, tagline: true }, a)) return;
      break;
    case "jenis":
      if (!form.businessType) {
        errors.value = { businessType: "Pilih jenis usahamu" };
        return;
      }
      // Kuliner hampir selalu perlu jam buka — nyalakan sebagai default cerdas.
      form.showHours = form.businessType === "kuliner";
      break;
    case "jual-apa":
      if (!jualApa.value) {
        errors.value = { jualApa: "Pilih dulu apa yang kamu jual" };
        return;
      }
      break;
    case "merk":
      if (!brandId.value) {
        errors.value = { brandId: "Pilih satu merk" };
        return;
      }
      break;
    case "kota":
      if (!cityCode.value) {
        errors.value = { cityCode: "Pilih kota tempatmu berjualan" };
        return;
      }
      break;
    case "model":
      if (modelDipilih.value.length === 0) {
        errors.value = { model: "Pilih minimal satu model" };
        return;
      }
      if (terlaluBanyakModel.value) {
        errors.value = { model: `Maksimal ${MAX_SEED_MODELS} model sekali jalan` };
        return;
      }
      trackEvent({
        name: "wizard_models_selected",
        count: modelDipilih.value.length,
        variantCount: varianAkanDibuat.value,
      });
      break;
    case "kontak":
      form.whatsapp = normalizeWhatsapp(form.whatsapp);
      if (!validate({ address: true, whatsapp: true }, a)) return;
      break;
    case "jam":
      if (form.showHours && !validate({ openingHours: true }, a)) return;
      break;
    case "andalan":
      if (!validate({ highlights: true }, a)) return;
      break;
  }

  step.value++;
  await siapkanStep();
}

/** Muatan data yang dibutuhkan step berikutnya, dijalankan setelah pindah. */
async function siapkanStep() {
  if (stepId.value === "merk" && brandList.value.length === 0) await muatMerk();
  if (stepId.value === "kota" && cityList.value.length === 0) await muatKota();
  if (stepId.value === "model" && modelList.value.length === 0) await muatModel();
  if (stepId.value === "subdomain" && !subdomain.value) {
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

    // Materialisasi katalog SETELAH situs jadi: seed menulis ke inventaris
    // tenant, jadi tenant dan template-nya harus sudah ada. Kegagalan di sini
    // tidak membatalkan situs yang sudah berhasil dibuat — user tetap masuk ke
    // layar hasil, dengan inventaris kosong yang bisa diisi manual.
    if (pakaiKatalog.value && modelDipilih.value.length > 0) {
      try {
        const seed = await seedInventory(tenant.value.id, {
          vertical: vertical.value,
          brandId: brandId.value,
          cityCode: cityCode.value,
          modelIds: modelDipilih.value,
        });
        seedResult.value = seed;
        trackEvent({
          name: "seed_inventory_done",
          createdVariants: seed.createdVariants,
          warningCount: seed.warnings.length,
        });
      } catch (err) {
        seedWarningError.value = apiErrorOf(err).message;
      }
    }

    selesai.value = true; // layar hasil: ringkasan seed → preview + publish
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

</script>

<template>
  <DashboardShell>
    <!-- Layar hasil: situs sudah jadi → ringkasan seed, lalu preview + publish -->
    <template v-if="selesai && tenant">
      <!--
        Ringkasan seed tampil SEBELUM preview. Kalau ada harga estimasi, itu
        baris pertama: harga salah yang terlihat pasti membuat sales kehilangan
        deal, dan satu-satunya cara mencegahnya adalah menaruhnya di jalan.
      -->
      <section
        v-if="seedResult || seedWarningError"
        class="mb-6 rounded-xl border border-slate-200 bg-white p-4"
      >
        <h2 class="text-base font-semibold text-slate-900">Unit dari katalog sudah disiapkan</h2>

        <p v-if="seedWarningError" class="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ seedWarningError }} — kamu tetap bisa menambahkan unit secara manual.
        </p>

        <template v-if="seedResult">
          <p class="mt-1 text-sm text-slate-600">
            {{ seedResult.createdModels }} model ·
            {{ seedResult.createdVariants }} varian dibuat.
          </p>

          <ul v-if="warningTerurut.length" class="mt-3 space-y-2">
            <li
              v-for="(w, i) in warningTerurut"
              :key="i"
              class="rounded-lg px-3 py-2 text-sm"
              :class="
                w.kind === 'price_estimated'
                  ? 'bg-amber-50 text-amber-900'
                  : 'bg-slate-50 text-slate-600'
              "
            >
              {{ labelWarning(w) }}
            </li>
          </ul>

          <p class="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Semua unit masih <strong>belum dipublikasikan</strong>. Periksa harganya, lalu
            publikasikan satu per satu.
          </p>

          <NuxtLink
            :to="`/dashboard/unit`"
            class="mt-3 inline-block w-full rounded-lg bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Periksa harga unit
          </NuxtLink>
        </template>
      </section>

      <DashboardPublish
        :tenant="tenant"
        :preview-url="previewUrl"
        :business-name="form.businessName"
        @updated="tenant = $event"
      />
    </template>

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
            v-for="i in steps.length"
            :key="i"
            class="h-1.5 flex-1 rounded-full"
            :class="i - 1 <= step ? 'bg-teal-600' : 'bg-slate-200'"
          />
        </div>
        <p class="mt-2 text-xs text-slate-500">Langkah {{ step + 1 }} dari {{ steps.length }}</p>
        <h1 class="mt-3 text-xl font-bold text-slate-900">
          {{ stepId === "andalan" ? andalanCopy.judul : STEP_TITLES[stepId] }}
        </h1>
      </div>

      <p v-if="bootError" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ bootError }}
      </p>
      <p v-if="errors._" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ errors._ }}
      </p>

      <form class="space-y-5" novalidate @submit.prevent="langkahTerakhir ? buildSite() : nextStep()">
        <!-- 1. Nama usaha -->
        <template v-if="stepId === 'nama'">
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
        <template v-else-if="stepId === 'jenis'">
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

        <!-- Otomotif: jual apa (menurunkan salesMode D-01 + vertikal katalog) -->
        <template v-else-if="stepId === 'jual-apa'">
          <p v-if="errors.jualApa" class="text-sm text-red-600">{{ errors.jualApa }}</p>
          <div class="grid gap-3">
            <button
              v-for="opsi in JUAL_APA"
              :key="opsi.id"
              type="button"
              class="flex items-center gap-3 rounded-xl border-2 bg-white p-4 text-left"
              :class="jualApa === opsi.id ? 'border-teal-600 ring-1 ring-teal-600' : 'border-slate-200'"
              :aria-pressed="jualApa === opsi.id"
              @click="pilihJualApa(opsi.id)"
            >
              <span class="text-2xl" aria-hidden="true">{{ opsi.icon }}</span>
              <span>
                <span class="block font-semibold text-slate-900">{{ opsi.label }}</span>
                <span class="block text-sm text-slate-500">{{ opsi.hint }}</span>
              </span>
            </button>
          </div>
          <p class="text-xs text-slate-500">
            Kalau kamu jual unit baru, kami siapkan daftar model dan harganya supaya kamu tidak
            mengetik dari nol.
          </p>
        </template>

        <!-- Otomotif: merk (satu saja; "tambah merk lain" ada di editor) -->
        <template v-else-if="stepId === 'merk'">
          <p v-if="errors.brandId" class="text-sm text-red-600">{{ errors.brandId }}</p>
          <p v-if="katalogBusy" class="text-sm text-slate-500">Memuat daftar merk…</p>
          <div v-else class="grid grid-cols-2 gap-3">
            <button
              v-for="brand in brandList"
              :key="brand.id"
              type="button"
              class="rounded-xl border-2 bg-white px-4 py-5 text-center font-semibold text-slate-900"
              :class="brandId === brand.id ? 'border-teal-600 ring-1 ring-teal-600' : 'border-slate-200'"
              :aria-pressed="brandId === brand.id"
              @click="pilihMerk(brand)"
            >
              {{ brand.name }}
            </button>
          </div>
          <p class="text-xs text-slate-500">
            Pilih satu dulu. Merk lain bisa ditambahkan kapan saja dari dashboard.
          </p>
        </template>

        <!-- Otomotif: kota — menentukan harga OTR yang tampil di situs (D-03) -->
        <template v-else-if="stepId === 'kota'">
          <p v-if="errors.cityCode" class="text-sm text-red-600">{{ errors.cityCode }}</p>
          <p v-if="katalogBusy && !cityList.length" class="text-sm text-slate-500">
            Memuat daftar kota…
          </p>
          <div v-else class="grid gap-2">
            <button
              v-for="kota in cityList"
              :key="kota.code"
              type="button"
              class="flex items-center justify-between rounded-xl border-2 bg-white px-4 py-3 text-left"
              :class="cityCode === kota.code ? 'border-teal-600 ring-1 ring-teal-600' : 'border-slate-200'"
              :aria-pressed="cityCode === kota.code"
              @click="pilihKota(kota)"
            >
              <span class="font-medium text-slate-900">{{ kota.name }}</span>
              <span v-if="!kota.hasExactPrice" class="text-xs text-amber-700">estimasi</span>
            </button>
          </div>

          <!--
            Kota tanpa OTR sendiri TIDAK diblokir — diberi peringatan. Lebih baik
            tidak ada angka daripada angka salah tanpa penanda (D-14).
          -->
          <p
            v-if="kotaTerpilih && !kotaTerpilih.hasExactPrice"
            class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            OTR untuk {{ kotaTerpilih.name }} belum tersedia — kami pakai harga
            {{ kotaFallback }} sebagai estimasi. Tolong periksa sebelum publish.
          </p>
        </template>

        <!-- Otomotif: model yang dijual (D-13) -->
        <template v-else-if="stepId === 'model'">
          <p v-if="errors.model" class="text-sm text-red-600">{{ errors.model }}</p>
          <p v-if="katalogBusy && !modelList.length" class="text-sm text-slate-500">
            Memuat daftar model…
          </p>

          <template v-else>
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium text-slate-700">
                {{ modelDipilih.length }} model · {{ varianAkanDibuat }} varian akan dibuat
              </p>
              <button type="button" class="text-sm font-semibold text-teal-700" @click="toggleSemuaModel">
                {{ semuaTercentang ? "Kosongkan" : "Pilih semua" }}
              </button>
            </div>

            <p v-if="terlaluBanyakModel" class="text-sm text-red-600">
              Maksimal {{ MAX_SEED_MODELS }} model sekali jalan. Sisanya bisa ditambahkan nanti.
            </p>

            <div class="grid gap-3">
              <button
                v-for="m in modelList"
                :key="m.id"
                type="button"
                class="flex items-center gap-3 rounded-xl border-2 bg-white p-3 text-left"
                :class="
                  modelDipilih.includes(m.id)
                    ? 'border-teal-600 ring-1 ring-teal-600'
                    : 'border-slate-200'
                "
                :aria-pressed="modelDipilih.includes(m.id)"
                @click="toggleModel(m.id)"
              >
                <img
                  :src="m.thumbnailUrl"
                  :alt="m.name"
                  class="size-16 shrink-0 rounded-lg bg-slate-100 object-cover"
                  loading="lazy"
                />
                <span class="min-w-0">
                  <span class="block font-semibold text-slate-900">{{ m.name }}</span>
                  <span class="block text-sm text-slate-500">{{ m.variantCount }} varian</span>
                  <span v-if="m.priceFrom !== null" class="block text-sm text-slate-700">
                    mulai {{ formatRupiah(m.priceFrom) }}
                    <span v-if="m.priceEstimated" class="text-amber-700">(estimasi)</span>
                  </span>
                </span>
              </button>
            </div>

            <p class="text-xs text-slate-500">
              Yang populer sudah dicentang. Hapus centang model yang tidak kamu jual — semuanya
              tetap bisa diubah nanti.
            </p>
          </template>
        </template>

        <!-- 3. Alamat + WhatsApp -->
        <template v-else-if="stepId === 'kontak'">
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
        <template v-else-if="stepId === 'jam'">
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
        <template v-else-if="stepId === 'andalan'">
          <p class="text-sm text-slate-500">{{ andalanCopy.petunjuk }}</p>
          <p v-if="errors.highlights" class="text-sm text-red-600">{{ errors.highlights }}</p>
          <div
            v-for="(item, i) in form.highlights"
            :key="i"
            class="rounded-xl border border-slate-200 bg-white p-4"
          >
            <WizardField
              :label="`${andalanCopy.label} ${i + 1}`"
              :error="errors[`highlights.${i}.name`]"
            >
              <input
                v-model="item.name"
                type="text"
                :placeholder="andalanCopy.placeholder"
                :class="inputClass"
              />
            </WizardField>
            <div class="mt-3">
              <WizardField
                :label="andalanCopy.labelHarga"
                optional
                :error="errors[`highlights.${i}.price`]"
              >
                <div class="flex items-center gap-2">
                  <span class="text-sm text-slate-500">Rp</span>
                  <input
                    v-model="item.price"
                    type="text"
                    inputmode="numeric"
                    :placeholder="andalanCopy.placeholderHarga"
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
            {{ andalanCopy.tambah }}
          </button>
        </template>

        <!-- 6. Alamat situs (subdomain) -->
        <template v-else-if="stepId === 'subdomain'">
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
          :disabled="busy || !tenant || (langkahTerakhir && subdomainState !== 'ok')"
          class="w-full rounded-lg bg-teal-600 px-4 py-3.5 text-base font-semibold text-white disabled:opacity-50"
        >
          <template v-if="busy">Membuat situs…</template>
          <template v-else-if="langkahTerakhir">Buat situs saya</template>
          <template v-else>Lanjut</template>
        </button>
      </form>
    </template>
  </DashboardShell>
</template>
