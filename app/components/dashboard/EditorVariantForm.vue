<script setup lang="ts">
/**
 * Editor satu varian (Fase 7c butir 4, "Editor varian bersarang").
 *
 * Mobile-first: satu kolom penuh di 360px, grup spesifikasi memakai <details>
 * supaya form panjang tidak memaksa scroll tanpa ujung, dan tabel harga OTR
 * ditata sebagai baris — bukan tabel lebar yang menuntut scroll horizontal.
 */
import type { City, SpecDef, SpecValue, VehicleVariant, VehicleVertical } from "@marketplaceindo/shared";
import ProvenanceBadge from "./ProvenanceBadge.vue";

const props = defineProps<{
  variant: VehicleVariant;
  vertical: VehicleVertical;
  /** Merk model — dipakai badge "Dari katalog {merk}". */
  brand?: string;
  /** Kota tenant (settingsJson.cities), bukan dari katalog. */
  cities: City[];
  /** Key spesifikasi yang kosong di sini tapi terisi di varian lain. */
  kosongDiVarianLain: string[];
  errors?: Record<string, string>;
}>();

const emit = defineEmits<{ "update:variant": [VehicleVariant]; duplikat: []; hapus: [] }>();

const STOK = [
  ["ready", "Ready"],
  ["indent", "Indent"],
  ["habis", "Habis"],
] as const;

/** Field spesifikasi DIFILTER per vertikal — lihat app/utils/vehicle-model-editor. */
const grupSpec = computed(() => specFieldGroups(props.vertical));

const selisih = ref<number>(0);

function patch(bagian: Partial<VehicleVariant>) {
  emit("update:variant", { ...props.variant, ...bagian });
}

function nilaiSpec(key: string): SpecValue | undefined {
  return (props.variant.specs as Record<string, SpecValue | undefined>)[key];
}

function setSpec(def: SpecDef, raw: string | boolean) {
  const specs = { ...(props.variant.specs as Record<string, SpecValue | undefined>) };
  if (raw === "" || raw === undefined) delete specs[def.key];
  else if (def.valueType === "number") {
    const n = Number(String(raw).replace(/[^\d.-]/g, ""));
    if (Number.isNaN(n)) delete specs[def.key];
    else specs[def.key] = n;
  } else specs[def.key] = raw as SpecValue;
  patch({ specs: specs as VehicleVariant["specs"] });
}

function setHarga(cityCode: string, cityName: string, nilai: string) {
  const price = Number(String(nilai).replace(/[^\d]/g, "")) || 0;
  // Mengubah harga manual mematikan status estimasi (lihat setHargaKota).
  emit("update:variant", setHargaKota(props.variant, cityCode, price, { cityName }));
}

function terapkanSelisih() {
  if (!selisih.value) return;
  emit("update:variant", terapkanSelisihSemuaKota(props.variant, selisih.value));
  selisih.value = 0;
}

function hargaKota(code: string): number | "" {
  const found = props.variant.priceOtr.find((p) => p.cityCode === code);
  return found ? found.price : "";
}

const highlightsText = computed({
  get: () => props.variant.highlights.join("\n"),
  set: (v: string) =>
    patch({ highlights: v.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 6) }),
});

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:border-teal-600 focus:outline-none";
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-4">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <label class="block text-sm font-medium text-slate-700">Nama varian</label>
        <input
          :value="variant.name"
          type="text"
          placeholder="Ultimate CVT"
          :class="inputClass"
          class="mt-1"
          @input="patch({ name: ($event.target as HTMLInputElement).value })"
        />
        <p v-if="errors?.name" class="mt-1 text-xs text-red-600">{{ errors.name }}</p>
      </div>
    </div>

    <ProvenanceBadge
      class="mt-2"
      :brand="brand"
      :price-source="variant.priceSource"
      :price-updated-at="variant.priceUpdatedAt"
      :price-estimated="variant.priceEstimated"
      :price-estimated-from-city="variant.priceEstimatedFromCity"
    />

    <div class="mt-3 grid grid-cols-2 gap-2">
      <label class="block text-sm">
        <span class="mb-1 block font-medium text-slate-700">Urutan trim</span>
        <input
          :value="variant.trimRank"
          type="number"
          min="0"
          :class="inputClass"
          @input="patch({ trimRank: Number(($event.target as HTMLInputElement).value) || 0 })"
        />
      </label>
      <label class="block text-sm">
        <span class="mb-1 block font-medium text-slate-700">Stok</span>
        <select
          :value="variant.stockStatus"
          :class="inputClass"
          @change="patch({ stockStatus: ($event.target as HTMLSelectElement).value as VehicleVariant['stockStatus'] })"
        >
          <option v-for="[v, l] in STOK" :key="v" :value="v">{{ l }}</option>
        </select>
      </label>
    </div>

    <label class="mt-3 flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        class="size-4 accent-teal-600"
        :checked="variant.isFeatured"
        @change="patch({ isFeatured: ($event.target as HTMLInputElement).checked })"
      />
      <span class="text-slate-700">Varian unggulan (dipakai di kartu model)</span>
    </label>

    <!-- Harga OTR per kota: satu baris per kota, tanpa scroll horizontal -->
    <section class="mt-4">
      <h4 class="text-sm font-semibold text-slate-900">Harga OTR per kota</h4>
      <p v-if="!cities.length" class="mt-1 text-xs text-slate-500">
        Belum ada kota. Tambahkan daftar kota di pengaturan otomotif dulu.
      </p>
      <ul v-else class="mt-2 space-y-2">
        <li v-for="c in cities" :key="c.code" class="flex items-center gap-2">
          <span class="w-24 shrink-0 truncate text-sm text-slate-600">{{ c.name }}</span>
          <input
            :value="hargaKota(c.code)"
            type="number"
            inputmode="numeric"
            step="500000"
            min="0"
            placeholder="0"
            :class="inputClass"
            :aria-label="`Harga OTR ${c.name}`"
            @input="setHarga(c.code, c.name, ($event.target as HTMLInputElement).value)"
          />
        </li>
      </ul>

      <div v-if="cities.length" class="mt-2 flex items-center gap-2">
        <input
          v-model.number="selisih"
          type="number"
          step="500000"
          placeholder="Selisih, mis. 2000000"
          :class="inputClass"
          aria-label="Selisih harga untuk semua kota"
        />
        <button
          type="button"
          class="shrink-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700"
          @click="terapkanSelisih"
        >
          Terapkan ke semua
        </button>
      </div>
    </section>

    <!-- Spesifikasi: HANYA key yang berlaku untuk vertikal model ini -->
    <section class="mt-4">
      <h4 class="text-sm font-semibold text-slate-900">Spesifikasi</h4>

      <p
        v-if="kosongDiVarianLain.length"
        class="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"
        data-testid="spec-kosong"
      >
        {{ kosongDiVarianLain.length }} spesifikasi belum diisi di varian ini tapi terisi di
        varian lain. Membiarkannya kosong membuat tabel perbandingan bolong.
      </p>

      <details
        v-for="g in grupSpec"
        :key="g.group"
        class="mt-2 rounded-lg border border-slate-200"
        :data-spec-group="g.group"
      >
        <summary class="cursor-pointer px-3 py-2 text-sm font-medium capitalize text-slate-700">
          {{ g.group }}
        </summary>
        <div class="space-y-3 border-t border-slate-200 p-3">
          <label
            v-for="def in g.fields"
            :key="def.key"
            class="block text-sm"
            :data-spec-key="def.key"
          >
            <span class="mb-1 flex items-center gap-2 font-medium text-slate-700">
              {{ def.label }}
              <span
                v-if="kosongDiVarianLain.includes(def.key)"
                class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-normal text-amber-900"
              >
                terisi di varian lain
              </span>
            </span>

            <!-- bool → toggle; kosong tetap "belum diisi", bukan "tidak ada" -->
            <select
              v-if="def.valueType === 'bool'"
              :value="nilaiSpec(def.key) === undefined ? '' : String(nilaiSpec(def.key))"
              :class="inputClass"
              @change="
                setSpec(
                  def,
                  ($event.target as HTMLSelectElement).value === ''
                    ? ''
                    : ($event.target as HTMLSelectElement).value === 'true',
                )
              "
            >
              <option value="">— belum diisi</option>
              <option value="true">Ada</option>
              <option value="false">Tidak ada</option>
            </select>

            <select
              v-else-if="def.valueType === 'enum'"
              :value="nilaiSpec(def.key) ?? ''"
              :class="inputClass"
              @change="setSpec(def, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">— belum diisi</option>
              <option v-for="opt in def.enumValues ?? []" :key="opt" :value="opt">{{ opt }}</option>
            </select>

            <div v-else-if="def.valueType === 'number'" class="flex items-center gap-2">
              <input
                :value="nilaiSpec(def.key) ?? ''"
                type="number"
                inputmode="numeric"
                :class="inputClass"
                @input="setSpec(def, ($event.target as HTMLInputElement).value)"
              />
              <span v-if="def.unit" class="shrink-0 text-sm text-slate-500">{{ def.unit }}</span>
            </div>

            <input
              v-else
              :value="nilaiSpec(def.key) ?? ''"
              type="text"
              maxlength="120"
              :class="inputClass"
              @input="setSpec(def, ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </details>
    </section>

    <label class="mt-4 block text-sm">
      <span class="mb-1 block font-medium text-slate-700">
        Highlight <span class="font-normal text-slate-400">(satu per baris, maks 6)</span>
      </span>
      <textarea v-model="highlightsText" rows="3" :class="inputClass" />
    </label>

    <div class="mt-4 flex gap-2">
      <button
        type="button"
        class="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700"
        @click="emit('duplikat')"
      >
        Duplikat varian
      </button>
      <button
        type="button"
        class="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-700"
        @click="emit('hapus')"
      >
        Hapus
      </button>
    </div>
  </div>
</template>
