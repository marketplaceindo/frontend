<script setup lang="ts">
/**
 * Editor model kendaraan baru + varian bersarang (Fase 7c butir 4).
 *
 * Model dan varian disimpan dalam SATU permintaan (kontrak §7.1: body memuat
 * model + minimal 1 varian), jadi seluruh draft hidup di state lokal sampai
 * tombol Simpan ditekan.
 */
import {
  bodyTypesFor,
  vehicleModelInputSchema,
  VEHICLE_VERTICALS,
  type City,
  type VehicleModel,
  type VehicleVertical,
} from "@marketplaceindo/shared";
import EditorVariantForm from "./EditorVariantForm.vue";
import EditorImageList from "./EditorImageList.vue";
import ProvenanceBadge from "./ProvenanceBadge.vue";

const props = defineProps<{
  tenantId: string;
  cities: City[];
  /** Model yang diedit; kosong = buat baru. */
  model?: VehicleModel | null;
}>();

const emit = defineEmits<{ tersimpan: [VehicleModel]; batal: [] }>();

const { createVehicleModel, updateVehicleModel } = useEditor();

const VERTICAL_LABEL: Record<VehicleVertical, string> = { mobil: "Mobil", motor: "Motor" };
const BODY_LABEL: Record<string, string> = {
  mpv: "MPV", suv: "SUV", sedan: "Sedan", hatchback: "Hatchback", pickup: "Pikap",
  lcgc: "LCGC", van: "Van", wagon: "Wagon",
  matic: "Matic", bebek: "Bebek", sport: "Sport", naked: "Naked", trail: "Trail",
  listrik: "Listrik", moge: "Moge",
};

function draftAwal(): VehicleModel {
  if (props.model) return structuredClone(toRaw(props.model));
  return {
    id: "",
    slug: "",
    vertical: "mobil",
    brand: "",
    name: "",
    modelYear: new Date().getFullYear(),
    bodyType: "mpv",
    images: [],
    summary: "",
    variants: [varianBaru("Tipe dasar", 0, props.cities)],
    isPublished: false,
    order: 0,
    createdAt: "",
    updatedAt: "",
  } as VehicleModel;
}

const draft = ref<VehicleModel>(draftAwal());
const errors = ref<Record<string, string>>({});
const formError = ref("");
const busy = ref(false);
const varianAktif = ref(0);

/** Body type SELALU difilter per vertikal — schema menolak kombinasi lain. */
const bodyOptions = computed(() => bodyTypesFor(draft.value.vertical));

/**
 * Mengganti vertikal mengosongkan bodyType yang jadi tidak berlaku. Tanpa ini
 * user melihat error validasi lintas-field yang tidak jelas asalnya.
 */
function gantiVertical(v: VehicleVertical) {
  draft.value.vertical = v;
  if (!bodyTypesFor(v).includes(draft.value.bodyType as never)) {
    draft.value.bodyType = bodyTypesFor(v)[0] as VehicleModel["bodyType"];
  }
}

const kosongPerVarian = computed(() =>
  draft.value.variants.map((_, i) => specKosongDiVarianLain(draft.value.variants, i)),
);

function tambahVarian() {
  draft.value.variants.push(
    varianBaru(`Tipe ${draft.value.variants.length + 1}`, draft.value.variants.length, props.cities),
  );
  varianAktif.value = draft.value.variants.length - 1;
}

function duplikat(index: number) {
  const sumber = draft.value.variants[index];
  if (!sumber) return;
  draft.value.variants.splice(index + 1, 0, duplikatVarian(sumber));
  varianAktif.value = index + 1;
}

function hapusVarian(index: number) {
  if (draft.value.variants.length <= 1) {
    formError.value = "Model harus punya minimal satu varian.";
    return;
  }
  draft.value.variants.splice(index, 1);
  varianAktif.value = Math.max(0, index - 1);
}

async function simpan() {
  errors.value = {};
  formError.value = "";

  const payload = {
    ...draft.value,
    slug: draft.value.slug || undefined,
    variants: draft.value.variants,
  };
  const parsed = vehicleModelInputSchema.safeParse(payload);
  if (!parsed.success) {
    errors.value = zodFieldErrors(parsed.error.issues);
    formError.value = "Periksa lagi isian yang ditandai.";
    return;
  }

  busy.value = true;
  try {
    const hasil = props.model?.id
      ? await updateVehicleModel(props.model.id, parsed.data)
      : await createVehicleModel(props.tenantId, parsed.data);
    emit("tersimpan", hasil);
  } catch (err) {
    const e = apiErrorOf(err);
    if (e.fieldErrors) {
      errors.value = Object.fromEntries(
        Object.entries(e.fieldErrors).map(([k, v]) => [k, v[0] ?? ""]),
      );
    }
    formError.value = e.message;
  } finally {
    busy.value = false;
  }
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:border-teal-600 focus:outline-none";
</script>

<template>
  <div>
    <h3 class="font-semibold text-slate-900">
      {{ model?.id ? "Ubah model" : "Tambah model" }}
    </h3>

    <ProvenanceBadge
      v-if="model?.catalogModelId"
      class="mt-2"
      :brand="draft.brand"
      price-source="catalog"
    />

    <div class="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div class="grid grid-cols-2 gap-2">
        <label class="block text-sm">
          <span class="mb-1 block font-medium text-slate-700">Jenis</span>
          <select
            :value="draft.vertical"
            :class="inputClass"
            @change="gantiVertical(($event.target as HTMLSelectElement).value as VehicleVertical)"
          >
            <option v-for="v in VEHICLE_VERTICALS" :key="v" :value="v">
              {{ VERTICAL_LABEL[v] }}
            </option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="mb-1 block font-medium text-slate-700">Tipe bodi</span>
          <select v-model="draft.bodyType" :class="inputClass">
            <option v-for="b in bodyOptions" :key="b" :value="b">{{ BODY_LABEL[b] ?? b }}</option>
          </select>
          <span v-if="errors.bodyType" class="mt-1 block text-xs text-red-600">
            {{ errors.bodyType }}
          </span>
        </label>
      </div>

      <label class="block text-sm">
        <span class="mb-1 block font-medium text-slate-700">Merk</span>
        <input v-model="draft.brand" type="text" placeholder="Mitsubishi" :class="inputClass" />
        <span v-if="errors.brand" class="mt-1 block text-xs text-red-600">{{ errors.brand }}</span>
      </label>

      <label class="block text-sm">
        <span class="mb-1 block font-medium text-slate-700">Nama model</span>
        <input v-model="draft.name" type="text" placeholder="Xpander" :class="inputClass" />
        <span v-if="errors.name" class="mt-1 block text-xs text-red-600">{{ errors.name }}</span>
      </label>

      <label class="block text-sm">
        <span class="mb-1 block font-medium text-slate-700">Tahun model</span>
        <input v-model.number="draft.modelYear" type="number" min="2000" max="2100" :class="inputClass" />
      </label>

      <label class="block text-sm">
        <span class="mb-1 block font-medium text-slate-700">Ringkasan</span>
        <textarea v-model="draft.summary" rows="2" maxlength="300" :class="inputClass" />
        <span v-if="errors.summary" class="mt-1 block text-xs text-red-600">{{ errors.summary }}</span>
      </label>

      <label class="block text-sm">
        <span class="mb-1 block font-medium text-slate-700">
          Deskripsi <span class="font-normal text-slate-400">(opsional)</span>
        </span>
        <textarea v-model="draft.description" rows="4" maxlength="4000" :class="inputClass" />
      </label>

      <div>
        <span class="mb-1 block text-sm font-medium text-slate-700">Foto model</span>
        <EditorImageList
          :tenant-id="tenantId"
          :model-value="draft.images"
          :max="20"
          @update:model-value="draft.images = $event as VehicleModel['images']"
        />
        <span v-if="errors.images" class="mt-1 block text-xs text-red-600">{{ errors.images }}</span>
      </div>

      <label class="flex items-center gap-2 text-sm">
        <input v-model="draft.isPublished" type="checkbox" class="size-4 accent-teal-600" />
        <span class="text-slate-700">Tampilkan di situs</span>
      </label>
    </div>

    <!-- Varian -->
    <section class="mt-5">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-slate-900">Varian ({{ draft.variants.length }})</h3>
        <button
          type="button"
          class="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white"
          @click="tambahVarian"
        >
          + Tambah varian
        </button>
      </div>

      <!-- Tab varian: hemat ruang di 360px, satu varian terlihat penuh -->
      <nav v-if="draft.variants.length > 1" class="mt-3 flex gap-1 overflow-x-auto pb-1">
        <button
          v-for="(v, i) in draft.variants"
          :key="v.id"
          type="button"
          class="shrink-0 rounded-full px-3 py-1.5 text-sm"
          :class="i === varianAktif ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'"
          @click="varianAktif = i"
        >
          {{ v.name || `Varian ${i + 1}` }}
        </button>
      </nav>

      <EditorVariantForm
        v-if="draft.variants[varianAktif]"
        :key="draft.variants[varianAktif]!.id"
        class="mt-3"
        :variant="draft.variants[varianAktif]!"
        :vertical="draft.vertical"
        :brand="draft.brand"
        :cities="cities"
        :kosong-di-varian-lain="kosongPerVarian[varianAktif] ?? []"
        @update:variant="draft.variants[varianAktif] = $event"
        @duplikat="duplikat(varianAktif)"
        @hapus="hapusVarian(varianAktif)"
      />
    </section>

    <p v-if="formError" class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ formError }}
    </p>

    <div class="mt-4 flex gap-2">
      <button
        type="button"
        :disabled="busy"
        class="flex-1 rounded-lg bg-teal-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
        @click="simpan"
      >
        {{ busy ? "Menyimpan…" : "Simpan model" }}
      </button>
      <button
        type="button"
        class="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium"
        @click="emit('batal')"
      >
        Batal
      </button>
    </div>
  </div>
</template>
