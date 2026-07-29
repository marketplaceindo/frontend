<script setup lang="ts">
/**
 * Simulasi kredit (addendum §4.2). Seluruh rumus hidup di
 * `@marketplaceindo/shared` (`ringkasanKredit`) supaya angka di web, notifikasi
 * WA, dan dashboard lead tidak pernah berbeda — komponen ini murni wiring input.
 *
 * Aturan yang tidak boleh dilanggar:
 * - metode SELALU berlabel (flat 5% ≈ efektif 9–10%);
 * - disclaimer wajib tampil, tidak bisa dimatikan tenant;
 * - semua hitungan client-side, tanpa network call.
 */
import {
  dpDariPersen,
  persenDariDp,
  premiAsuransi,
  ringkasanKredit,
  type Block,
  type MetodeKredit,
} from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "simulasi_kredit" }>["data"];
const props = defineProps<{
  data: Data;
  /** Harga OTR varian/unit (VDP); tanpa ini pakai contoh default. */
  hargaAwal?: number;
  /** Label unit untuk pesan WA ("Xpander Ultimate CVT"). */
  labelUnit?: string;
}>();

const site = useTenantSite();

const harga = ref(props.hargaAwal ?? 200_000_000);
const dpPersen = ref(props.data.dpDefaultPersen);
const tenor = ref(props.data.tenorOptionsBulan[0] ?? 12);
const metode = ref<MetodeKredit>(props.data.metodeDefault);
const bunga = ref(props.data.bungaPerTahunDefault);
const tipeAsuransi = ref(props.data.asuransi?.tipeDefault ?? "all_risk");

// Slider % ⇄ input Rp tetap sinkron (dua arah, satu sumber kebenaran: dpPersen).
const dpRupiah = computed({
  get: () => dpDariPersen(harga.value, dpPersen.value),
  set: (rp: number) => (dpPersen.value = persenDariDp(harga.value, rp)),
});

watch(
  () => props.hargaAwal,
  (nilai) => {
    if (nilai) harga.value = nilai;
  },
);

const dpInvalid = computed(() => dpPersen.value < props.data.dpMinPersen);

const asuransiTahunPertama = computed(() => {
  const cfg = props.data.asuransi;
  if (!cfg?.aktif) return 0;
  return premiAsuransi(harga.value, cfg.ratePersenPerTahun[tipeAsuransi.value]);
});

const hasil = computed(() => {
  if (dpInvalid.value) return null;
  try {
    return ringkasanKredit(
      {
        harga: harga.value,
        dp: dpRupiah.value,
        tenorBulan: tenor.value,
        bungaPerTahun: bunga.value,
      },
      metode.value,
      {
        adminRp: props.data.biayaTambahan?.adminRp,
        provisiPersen: props.data.biayaTambahan?.provisiPersen,
        fidusiaRp: props.data.biayaTambahan?.fidusiaRp,
        asuransiTahunPertamaRp: asuransiTahunPertama.value,
      },
    );
  } catch {
    return null;
  }
});

const utama = computed(() =>
  hasil.value ? (metode.value === "flat" ? hasil.value.flat : hasil.value.efektif) : null,
);

const METODE_LABEL: Record<MetodeKredit, string> = {
  flat: "bunga flat",
  efektif: "bunga efektif (anuitas)",
};

/**
 * CTA konversi tertinggi: pembeli yang sudah menghitung angsuran adalah pembeli
 * serius. Lead dikirim fire-and-forget dulu agar navigasi ke WA tidak tertunda.
 */
async function kirimKeSales() {
  const h = utama.value;
  if (!h) return;
  const unit = props.labelUnit ?? "unit ini";
  const pesan =
    `Halo, saya sudah simulasi kredit untuk ${unit}:\n` +
    `• Harga: ${formatRupiah(harga.value)}\n` +
    `• DP: ${formatRupiah(dpRupiah.value)} (${dpPersen.value}%)\n` +
    `• Tenor: ${tenor.value} bulan\n` +
    `• Angsuran: ${formatRupiah(h.angsuranPerBulan)}/bulan (${METODE_LABEL[metode.value]})\n` +
    `Bisa dibantu?`;

  const wa = site.value?.contact.whatsapp;
  try {
    await $fetch("/api/leads", {
      method: "POST",
      body: {
        source: "simulasi_kredit",
        nama: "(dari simulasi kredit)",
        telepon: "6280000000000",
        ...(props.labelUnit ? { refLabel: props.labelUnit } : {}),
        meta: {
          harga: harga.value,
          dp: dpRupiah.value,
          tenorBulan: tenor.value,
          bungaPerTahun: bunga.value,
          metode: metode.value,
          angsuranPerBulan: h.angsuranPerBulan,
        },
      },
    });
  } catch {
    // Lead gagal tidak boleh menghalangi user membuka WhatsApp.
  }
  if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(pesan)}`, "_blank", "noopener");
}

const inputClass = "w-full rounded-theme border border-text/20 bg-bg px-3 py-2";
</script>

<template>
  <div class="section-inner max-w-2xl py-8 md:py-12">
    <h2 class="mb-6 text-2xl font-bold md:text-3xl">{{ data.heading ?? "Simulasi Kredit" }}</h2>

    <form class="grid gap-4 sm:grid-cols-2" @submit.prevent>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">Harga (Rp)</span>
        <input v-model.number="harga" type="number" min="1000000" step="1000000" :class="inputClass" />
      </label>

      <label class="block text-sm">
        <span class="mb-1 block font-medium">
          Uang muka — min. {{ data.dpMinPersen }}%
        </span>
        <input
          v-model.number="dpPersen"
          type="range"
          :min="data.dpMinPersen"
          max="90"
          class="w-full accent-primary"
        />
        <input v-model.number="dpRupiah" type="number" step="500000" :class="inputClass" />
        <span class="mt-1 block text-xs opacity-70">{{ dpPersen }}% dari harga</span>
      </label>

      <label class="block text-sm">
        <span class="mb-1 block font-medium">Tenor</span>
        <select v-model.number="tenor" :class="inputClass">
          <option v-for="t in data.tenorOptionsBulan" :key="t" :value="t">{{ t }} bulan</option>
        </select>
      </label>

      <label class="block text-sm">
        <span class="mb-1 block font-medium">Bunga per tahun (%)</span>
        <input v-model.number="bunga" type="number" min="0" max="60" step="0.1" :class="inputClass" />
      </label>

      <label v-if="data.asuransi?.aktif" class="block text-sm">
        <span class="mb-1 block font-medium">Asuransi</span>
        <select v-model="tipeAsuransi" :class="inputClass">
          <option value="all_risk">All Risk</option>
          <option value="tlo">TLO</option>
        </select>
      </label>

      <label class="block text-sm">
        <span class="mb-1 block font-medium">Metode bunga</span>
        <select v-model="metode" :class="inputClass">
          <option value="flat">Flat</option>
          <option value="efektif">Efektif (anuitas)</option>
        </select>
      </label>
    </form>

    <p v-if="dpInvalid" class="mt-4 rounded-theme border border-text/20 p-3 text-sm">
      Uang muka minimal {{ data.dpMinPersen }}% dari harga.
    </p>

    <template v-else-if="hasil && utama">
      <dl class="mt-6 rounded-theme border border-text/10 p-5" data-testid="hasil-kredit">
        <div class="flex items-baseline justify-between border-b border-text/10 pb-3">
          <dt class="font-semibold">Angsuran/bulan</dt>
          <dd class="text-2xl font-bold text-primary">
            {{ formatRupiah(utama.angsuranPerBulan) }}
          </dd>
        </div>
        <p class="pt-2 text-xs opacity-70">Metode {{ METODE_LABEL[metode] }}</p>

        <div class="mt-3 flex justify-between py-1 text-sm">
          <dt>Pokok utang</dt>
          <dd class="font-medium">{{ formatRupiah(utama.pokok) }}</dd>
        </div>
        <div class="flex justify-between py-1 text-sm">
          <dt>Total bunga {{ tenor }} bulan</dt>
          <dd>{{ formatRupiah(utama.totalBunga) }}</dd>
        </div>
        <div class="flex justify-between border-t border-text/10 pt-2 text-sm">
          <dt class="font-semibold">Dana yang disiapkan di awal</dt>
          <dd class="font-bold">{{ formatRupiah(hasil.danaAwal) }}</dd>
        </div>
        <p class="pt-1 text-xs opacity-70">
          DP {{ formatRupiah(hasil.rincianDanaAwal.dp) }}
          <template v-if="hasil.rincianDanaAwal.asuransiTahunPertama">
            + asuransi th-1 {{ formatRupiah(hasil.rincianDanaAwal.asuransiTahunPertama) }}
          </template>
          <template v-if="hasil.rincianDanaAwal.admin">
            + admin {{ formatRupiah(hasil.rincianDanaAwal.admin) }}
          </template>
          <template v-if="hasil.rincianDanaAwal.provisi">
            + provisi {{ formatRupiah(hasil.rincianDanaAwal.provisi) }}
          </template>
          <template v-if="hasil.rincianDanaAwal.fidusia">
            + fidusia {{ formatRupiah(hasil.rincianDanaAwal.fidusia) }}
          </template>
        </p>
      </dl>

      <!-- Perbandingan dua metode berdampingan: mencegah angka flat disalahartikan -->
      <div v-if="data.tampilkanKeduaMetode" class="mt-4 grid gap-3 sm:grid-cols-2">
        <div class="rounded-theme border border-text/10 p-4">
          <p class="text-xs font-medium opacity-70">Bunga flat</p>
          <p class="text-lg font-bold">{{ formatRupiah(hasil.flat.angsuranPerBulan) }}</p>
        </div>
        <div class="rounded-theme border border-text/10 p-4">
          <p class="text-xs font-medium opacity-70">Bunga efektif (anuitas)</p>
          <p class="text-lg font-bold">{{ formatRupiah(hasil.efektif.angsuranPerBulan) }}</p>
        </div>
      </div>

      <div v-if="data.leasingPartners.length" class="mt-4 text-xs opacity-70">
        Mitra pembiayaan: {{ data.leasingPartners.map((l) => l.nama).join(", ") }}
      </div>

      <button
        type="button"
        class="mt-5 w-full rounded-theme bg-primary px-5 py-3 font-semibold text-white"
        @click="kirimKeSales"
      >
        Kirim simulasi ini ke sales
      </button>
    </template>

    <p class="mt-4 text-xs leading-relaxed opacity-70">{{ data.disclaimer }}</p>
  </div>
</template>
