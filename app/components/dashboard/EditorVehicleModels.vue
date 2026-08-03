<script setup lang="ts">
/**
 * Daftar model kendaraan baru (Fase 7c butir 4).
 *
 * Banner checklist di atas mengubah `isPublished: false` hasil seed katalog dari
 * hambatan menjadi daftar kerja: tenant tahu persis berapa unit yang menunggu
 * dan apa langkah berikutnya (periksa harga → publikasikan).
 */
import type { City, VehicleModel } from "@marketplaceindo/shared";
import EditorModelForm from "./EditorModelForm.vue";
import ProvenanceBadge from "./ProvenanceBadge.vue";

const props = defineProps<{ tenantId: string; cities: City[] }>();

const { listVehicleModels, updateVehicleModel, deleteVehicleModel } = useEditor();

const editing = ref<VehicleModel | null>(null);
const membuat = ref(false);
const listError = ref("");
const bannerDitutup = ref(false);

const { data, refresh } = await useAsyncData<VehicleModel[]>(
  () => `vehicle-models:${props.tenantId}`,
  async () => (await listVehicleModels(props.tenantId)).items,
  { default: () => [] },
);

const models = computed(() => data.value ?? []);
const belumTerbit = computed(() => jumlahBelumTerbit(models.value));

async function muatUlang() {
  try {
    await refresh();
    listError.value = "";
  } catch (err) {
    listError.value = apiErrorOf(err).message;
  }
}

function mulaiBuat() {
  editing.value = null;
  membuat.value = true;
}

function mulaiUbah(model: VehicleModel) {
  editing.value = model;
  membuat.value = false;
}

function selesai() {
  editing.value = null;
  membuat.value = false;
  void muatUlang();
}

/** Publikasi cepat dari daftar — jalur utama setelah memeriksa harga. */
async function togglePublish(model: VehicleModel) {
  try {
    await updateVehicleModel(model.id, { isPublished: !model.isPublished });
    await muatUlang();
  } catch (err) {
    listError.value = apiErrorOf(err).message;
  }
}

async function hapus(model: VehicleModel) {
  if (!confirm(`Hapus model "${model.name}" beserta seluruh variannya?`)) return;
  try {
    await deleteVehicleModel(model.id);
    await muatUlang();
  } catch (err) {
    listError.value = apiErrorOf(err).message;
  }
}

/** Varian dengan harga estimasi — yang paling perlu diperiksa sebelum terbit. */
function jumlahEstimasi(model: VehicleModel): number {
  return model.variants.filter((v) => v.priceEstimated).length;
}
</script>

<template>
  <div>
    <EditorModelForm
      v-if="membuat || editing"
      :tenant-id="tenantId"
      :cities="cities"
      :model="editing"
      @tersimpan="selesai"
      @batal="selesai"
    />

    <template v-else>
      <!-- Checklist publikasi: nada daftar kerja, bukan peringatan -->
      <div
        v-if="belumTerbit > 0 && !bannerDitutup"
        class="mb-3 flex items-start gap-3 rounded-xl bg-amber-50 px-3 py-3"
        data-testid="banner-publikasi"
      >
        <p class="flex-1 text-sm text-amber-900">
          {{ belumTerbit }} unit belum dipublikasikan. Periksa harga, lalu publikasikan.
        </p>
        <button
          type="button"
          class="shrink-0 text-sm font-medium text-amber-800"
          aria-label="Tutup pemberitahuan"
          @click="bannerDitutup = true"
        >
          Tutup
        </button>
      </div>

      <button
        type="button"
        class="w-full rounded-lg bg-teal-600 py-3 text-sm font-semibold text-white"
        @click="mulaiBuat"
      >
        + Tambah model
      </button>

      <p v-if="listError" class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ listError }}
      </p>

      <p v-if="!models.length" class="mt-6 text-center text-sm text-slate-500">
        Belum ada model kendaraan baru.
      </p>

      <ul v-else class="mt-4 space-y-3">
        <li
          v-for="model in models"
          :key="model.id"
          class="rounded-xl border border-slate-200 bg-white p-4"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate font-semibold text-slate-900">
                {{ model.brand }} {{ model.name }}
              </p>
              <p class="mt-0.5 text-xs text-slate-500">
                {{ model.modelYear }} · {{ model.variants.length }} varian
              </p>
            </div>
            <span
              class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
              :class="model.isPublished ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-900'"
            >
              {{ model.isPublished ? "Tampil" : "Belum terbit" }}
            </span>
          </div>

          <ProvenanceBadge
            v-if="model.catalogModelId"
            class="mt-2"
            :brand="model.brand"
            price-source="catalog"
          />

          <p v-if="jumlahEstimasi(model)" class="mt-2 text-xs text-amber-900">
            {{ jumlahEstimasi(model) }} varian masih memakai harga estimasi — periksa sebelum terbit.
          </p>

          <div class="mt-3 flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700"
              @click="mulaiUbah(model)"
            >
              Ubah
            </button>
            <button
              type="button"
              class="flex-1 rounded-lg py-2.5 text-sm font-semibold"
              :class="model.isPublished ? 'border border-slate-300 text-slate-700' : 'bg-teal-600 text-white'"
              @click="togglePublish(model)"
            >
              {{ model.isPublished ? "Sembunyikan" : "Publikasikan" }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-red-300 px-3 py-2.5 text-sm font-medium text-red-700"
              :aria-label="`Hapus ${model.name}`"
              @click="hapus(model)"
            >
              Hapus
            </button>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>
