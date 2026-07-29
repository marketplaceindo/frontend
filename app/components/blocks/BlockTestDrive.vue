<script setup lang="ts">
/**
 * Form lead test drive (addendum §4.3). Tervalidasi dua arah — client memakai
 * `createLeadRequestSchema` shared lewat vee-validate, server memvalidasi ulang
 * di `/api/leads` (§1.4) dan fieldErrors-nya dipetakan balik ke field.
 *
 * Dua prinsip yang menentukan konversi: jangan berhenti di "terima kasih"
 * (selalu tawarkan konfirmasi WhatsApp), dan jangan pernah membuang isi form
 * saat gagal — pembeli lebih percaya percakapan WA daripada form yang hilang.
 */
import {
  createLeadRequestSchema,
  normalisasiTelepon,
  type Block,
  type CreateLeadResponse,
} from "@marketplaceindo/shared";
import { useForm } from "vee-validate";

type Data = Extract<Block, { type: "test_drive" }>["data"];
const props = defineProps<{
  data: Data;
  /** Unit yang sedang dilihat (VDP) — ditampilkan read-only, bukan select. */
  refLabel?: string;
  refSlug?: string;
  refType?: "model" | "variant" | "unit";
}>();

const site = useTenantSite();

/** Tanggal paling awal yang boleh dipilih: hari ini + minLeadTimeHari. */
const tanggalMin = computed(() => {
  const d = new Date();
  d.setDate(d.getDate() + props.data.minLeadTimeHari);
  return d.toISOString().slice(0, 10);
});

const { defineField, handleSubmit, errors, setErrors, isSubmitting, values } = useForm({
  validationSchema: zodTypedSchema(createLeadRequestSchema),
  initialValues: {
    source: "test_drive" as const,
    nama: "",
    telepon: "",
    hp: "",
    ...(props.refLabel ? { refLabel: props.refLabel } : {}),
    ...(props.refSlug ? { refSlug: props.refSlug } : {}),
    ...(props.refType ? { refType: props.refType } : {}),
  },
});

const [nama, namaAttrs] = defineField("nama");
const [telepon, teleponAttrs] = defineField("telepon");
const [hp, hpAttrs] = defineField("hp");

// Tanggal/slot/lokasi bukan field kontrak — ikut sebagai `meta` (§2.3).
const tanggal = ref("");
const slot = ref(props.data.slotWaktu[0] ?? "");
const lokasi = ref(props.data.lokasiOptions[0] ?? "__sendiri__");
const alamatSendiri = ref("");
const catatan = ref("");

const sukses = ref(false);
const gagalUmum = ref<string | null>(null);

/** Anti-spam: tombol terkunci 3 detik setelah mount (bot mengisi seketika). */
const siap = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
const PREFILL_COOKIE = "mi_lead_prefill";

onMounted(() => {
  timer = setTimeout(() => (siap.value = true), 3000);
  // Prefill dari lead sebelumnya di sesi yang sama.
  const saved = useCookie<{ nama?: string; telepon?: string } | null>(PREFILL_COOKIE).value;
  if (saved?.nama) nama.value = saved.nama;
  if (saved?.telepon) telepon.value = saved.telepon;
});
onBeforeUnmount(() => clearTimeout(timer));

const lokasiFinal = computed(() =>
  lokasi.value === "__sendiri__" ? alamatSendiri.value : lokasi.value,
);

/** Ringkasan form sebagai pesan WA — dipakai tombol konfirmasi & fallback. */
function pesanWa(): string {
  const baris = [
    `Halo, saya mau test drive ${props.refLabel ?? "unit ini"}.`,
    `Nama: ${values.nama ?? ""}`,
    `No HP: ${values.telepon ?? ""}`,
  ];
  if (props.data.butuhTanggal && tanggal.value) {
    baris.push(`Tanggal: ${tanggal.value}${slot.value ? ` (${slot.value})` : ""}`);
  }
  if (lokasiFinal.value) baris.push(`Lokasi: ${lokasiFinal.value}`);
  if (catatan.value) baris.push(`Catatan: ${catatan.value}`);
  return baris.join("\n");
}

const waHref = computed(() => {
  const wa = site.value?.contact.whatsapp;
  return wa ? `https://wa.me/${wa}?text=${encodeURIComponent(pesanWa())}` : "";
});

const onSubmit = handleSubmit(async (v) => {
  gagalUmum.value = null;
  try {
    await $fetch<CreateLeadResponse>("/api/leads", {
      method: "POST",
      body: {
        ...v,
        // Normalisasi 08xx → 628xx sebelum kirim (pola kontrak). Nomor yang
        // tak bisa dinormalisasi sudah ditolak validasi client, jadi fallback
        // ke input asli hanya untuk memuaskan tipe.
        telepon: normalisasiTelepon(v.telepon) ?? v.telepon,
        meta: {
          ...(props.data.butuhTanggal && tanggal.value ? { tanggal: tanggal.value } : {}),
          ...(slot.value ? { slotWaktu: slot.value } : {}),
          ...(lokasiFinal.value ? { lokasi: lokasiFinal.value } : {}),
          ...(catatan.value ? { catatan: catatan.value } : {}),
        },
      },
    });
    useCookie<{ nama: string; telepon: string }>(PREFILL_COOKIE, {
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    }).value = { nama: v.nama, telepon: normalisasiTelepon(v.telepon) ?? v.telepon };
    sukses.value = true;
  } catch (err) {
    const payload = (
      err as { data?: { data?: { error?: { fieldErrors?: Record<string, string[]> } } } }
    ).data?.data?.error;
    if (payload?.fieldErrors) {
      const mapped: Record<string, string> = {};
      for (const [path, messages] of Object.entries(payload.fieldErrors)) {
        mapped[path] = messages[0] ?? "Tidak valid";
      }
      setErrors(mapped);
    } else {
      // Jangan buang input — tawarkan jalur WA dengan isi form yang sama.
      gagalUmum.value = "Gagal mengirim. Kirim lewat WhatsApp saja?";
    }
  }
});

const inputClass = "w-full rounded-theme border border-text/20 bg-bg px-3 py-2.5";
</script>

<template>
  <div v-if="data.aktif" class="section-inner max-w-xl py-8 md:py-12">
    <h2 class="text-2xl font-bold md:text-3xl">{{ data.heading ?? "Jadwalkan Test Drive" }}</h2>
    <p v-if="data.description" class="mt-2 text-sm opacity-80">{{ data.description }}</p>

    <!-- Sukses: selalu tawarkan konfirmasi WA, jangan berhenti di "terima kasih" -->
    <div
      v-if="sukses"
      class="mt-6 rounded-theme border border-primary/40 bg-primary/10 p-5 text-center"
      data-testid="test-drive-sukses"
    >
      <p class="font-medium">{{ data.pesanSukses }}</p>
      <a
        v-if="data.fallbackWhatsApp && waHref"
        :href="waHref"
        target="_blank"
        rel="noopener"
        :class="ctaClass('primary')"
        class="mt-4"
      >
        Konfirmasi via WhatsApp
      </a>
    </div>

    <form v-else class="mt-6 space-y-4" novalidate @submit="onSubmit">
      <!-- Unit read-only: pembeli sudah memilih dengan sampai ke halaman ini -->
      <p v-if="refLabel" class="rounded-theme border border-text/20 px-3 py-2 text-sm">
        Unit: <strong>{{ refLabel }}</strong>
      </p>

      <label class="block text-sm">
        <span class="mb-1 block font-medium">Nama</span>
        <input
          v-model="nama"
          v-bind="namaAttrs"
          name="nama"
          type="text"
          autocomplete="name"
          :class="inputClass"
          :aria-invalid="!!errors.nama"
        />
        <span v-if="errors.nama" class="mt-1 block text-xs text-secondary">{{ errors.nama }}</span>
      </label>

      <label class="block text-sm">
        <span class="mb-1 block font-medium">No. HP / WhatsApp</span>
        <input
          v-model="telepon"
          v-bind="teleponAttrs"
          name="telepon"
          type="tel"
          inputmode="tel"
          placeholder="08xxxxxxxxxx"
          :class="inputClass"
          :aria-invalid="!!errors.telepon"
        />
        <span v-if="errors.telepon" class="mt-1 block text-xs text-secondary">
          {{ errors.telepon }}
        </span>
      </label>

      <label v-if="data.butuhTanggal" class="block text-sm">
        <span class="mb-1 block font-medium">Tanggal</span>
        <input v-model="tanggal" type="date" :min="tanggalMin" :class="inputClass" />
      </label>

      <label v-if="data.slotWaktu.length" class="block text-sm">
        <span class="mb-1 block font-medium">Waktu</span>
        <select v-model="slot" :class="inputClass">
          <option v-for="s in data.slotWaktu" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>

      <label class="block text-sm">
        <span class="mb-1 block font-medium">Lokasi</span>
        <select v-model="lokasi" :class="inputClass">
          <option v-for="l in data.lokasiOptions" :key="l" :value="l">{{ l }}</option>
          <option value="__sendiri__">Di alamat saya</option>
        </select>
      </label>
      <textarea
        v-if="lokasi === '__sendiri__'"
        v-model="alamatSendiri"
        rows="2"
        placeholder="Tulis alamatmu"
        :class="inputClass"
        aria-label="Alamat saya"
      />

      <label class="block text-sm">
        <span class="mb-1 block font-medium">
          Catatan <span class="opacity-60">(opsional)</span>
        </span>
        <textarea v-model="catatan" rows="2" :class="inputClass" />
      </label>

      <!-- Honeypot: tersembunyi dari manusia; diisi bot → ditolak schema (max 0) -->
      <input
        v-model="hp"
        v-bind="hpAttrs"
        name="hp"
        type="text"
        tabindex="-1"
        autocomplete="off"
        aria-hidden="true"
        class="hidden"
      />

      <div v-if="gagalUmum" class="rounded-theme border border-text/20 p-3 text-sm">
        <p>{{ gagalUmum }}</p>
        <a
          v-if="data.fallbackWhatsApp && waHref"
          :href="waHref"
          target="_blank"
          rel="noopener"
          class="mt-2 inline-block font-semibold text-primary"
        >
          Kirim lewat WhatsApp →
        </a>
      </div>

      <button type="submit" :class="ctaClass('primary')" :disabled="isSubmitting || !siap">
        {{ isSubmitting ? "Mengirim…" : "Ajukan Test Drive" }}
      </button>
    </form>
  </div>
</template>
