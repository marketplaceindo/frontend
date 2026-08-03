<script setup lang="ts">
/**
 * Editor koleksi (kontrak §7): CRUD VehicleUnit/Product + pencarian. Form field
 * diturunkan dari schema shared `vehicleUnitInputSchema`/`productInputSchema`
 * lewat introspeksi yang sama dengan editor block — jadi field baru di repo
 * shared otomatis muncul di sini.
 */
import {
  productInputSchema,
  vehicleUnitInputSchema,
  type Product,
  type VehicleUnit,
} from "@marketplaceindo/shared";
import EditorField from "./EditorField.vue";
import BulkPriceModal from "./BulkPriceModal.vue";

const props = defineProps<{ tenantId: string; kind: "vehicles" | "products" }>();

const editor = useEditor();

const q = ref("");
const loading = ref(false);
const listError = ref("");

const editing = ref<Record<string, unknown> | null>(null);
const editingId = ref<string | null>(null);
const errors = ref<Record<string, string>>({});
const busy = ref(false);
const formError = ref("");

const schema = computed(() =>
  props.kind === "vehicles" ? vehicleUnitInputSchema : productInputSchema,
);
const fields = computed(() => describeSchemaFields(schema.value));
const noun = computed(() => (props.kind === "vehicles" ? "unit" : "produk"));

let searchTimer: ReturnType<typeof setTimeout> | undefined;

// --- Harga massal lewat Excel (§4.3, D-16) --------------------------------
const bulkPriceOpen = ref(false);
const bulkPriceRingkasan = ref("");

/** Muatan awal ikut SSR (cookie sesi diteruskan useRequestFetch di useEditor). */
const { data, refresh } = await useAsyncData<(VehicleUnit | Product)[]>(
  () => `editor-collection:${props.tenantId}:${props.kind}`,
  () => {
    const query = q.value.trim() ? { q: q.value.trim() } : {};
    const request =
      props.kind === "vehicles"
        ? editor.listVehicles(props.tenantId, query)
        : editor.listProducts(props.tenantId, query);
    return request.then((r) => r.items).catch((err) => {
      listError.value = apiErrorOf(err).message;
      return [];
    });
  },
  { watch: [() => props.kind] },
);
const items = computed<(VehicleUnit | Product)[]>(() => data.value ?? []);

async function load() {
  loading.value = true;
  listError.value = "";
  await refresh();
  loading.value = false;
}

watch(() => props.kind, () => { q.value = ""; });
onBeforeUnmount(() => clearTimeout(searchTimer));

function onSearch(value: string) {
  q.value = value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(load, 350);
}

function startCreate() {
  editingId.value = null;
  editing.value = props.kind === "vehicles"
    ? { name: "", brand: "", year: new Date().getFullYear(), price: undefined }
    : { name: "", price: undefined };
  errors.value = {};
  formError.value = "";
}

function startEdit(item: VehicleUnit | Product) {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = item as Record<string, unknown> & {
    id: string;
    createdAt: string;
    updatedAt: string;
  };
  editingId.value = item.id;
  editing.value = { ...rest };
  errors.value = {};
  formError.value = "";
}

function setField(key: string, value: unknown) {
  if (!editing.value) return;
  if (value === "" || value === undefined) delete editing.value[key];
  else editing.value[key] = value;
}

async function save() {
  if (!editing.value) return;
  errors.value = {};
  formError.value = "";

  const parsed = schema.value.safeParse(editing.value);
  if (!parsed.success) {
    errors.value = zodFieldErrors(parsed.error.issues);
    formError.value = "Ada isian yang belum benar.";
    return;
  }

  busy.value = true;
  try {
    if (editingId.value) {
      props.kind === "vehicles"
        ? await editor.updateVehicle(editingId.value, parsed.data)
        : await editor.updateProduct(editingId.value, parsed.data);
    } else {
      props.kind === "vehicles"
        ? await editor.createVehicle(props.tenantId, parsed.data)
        : await editor.createProduct(props.tenantId, parsed.data);
    }
    editing.value = null;
    await load();
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

async function remove(item: VehicleUnit | Product) {
  if (!confirm(`Hapus "${item.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
  busy.value = true;
  try {
    props.kind === "vehicles"
      ? await editor.deleteVehicle(item.id)
      : await editor.deleteProduct(item.id);
    await load();
  } catch (err) {
    listError.value = apiErrorOf(err).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <!-- Form tambah/ubah -->
    <div v-if="editing" class="rounded-xl border border-slate-200 bg-white p-4">
      <h3 class="font-semibold text-slate-900">
        {{ editingId ? `Ubah ${noun}` : `Tambah ${noun}` }}
      </h3>
      <div class="mt-4 space-y-4">
        <EditorField
          v-for="field in fields"
          :key="field.key"
          :field="field"
          :model-value="editing[field.key]"
          :tenant-id="tenantId"
          :errors="errors"
          @update:model-value="setField(field.key, $event)"
        />
      </div>

      <p v-if="formError" class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ formError }}
      </p>

      <div class="mt-4 flex gap-2">
        <button
          type="button"
          :disabled="busy"
          class="flex-1 rounded-lg bg-teal-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
          @click="save"
        >
          {{ busy ? "Menyimpan…" : "Simpan" }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium"
          @click="editing = null"
        >
          Batal
        </button>
      </div>
    </div>

    <!-- Daftar -->
    <template v-else>
      <!--
        Perbarui harga massal hanya masuk akal untuk kendaraan baru: harganya
        hidup per (varian × kota), dan mengetiknya satu-satu dari HP adalah
        alasan nomor satu tenant berhenti memperbarui harga.
      -->
      <div v-if="kind === 'vehicles'" class="mb-3">
        <button
          type="button"
          class="w-full rounded-lg border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700"
          @click="bulkPriceOpen = true"
        >
          Perbarui harga lewat Excel
        </button>
        <p v-if="bulkPriceRingkasan" class="mt-2 text-sm text-slate-600">
          {{ bulkPriceRingkasan }}
        </p>
      </div>

      <BulkPriceModal
        v-if="bulkPriceOpen"
        :tenant-id="tenantId"
        @tutup="bulkPriceOpen = false"
        @selesai="
          (r) => {
            bulkPriceRingkasan = `${r.updated} harga diperbarui, ${r.skipped} dilewati.`;
            void load();
          }
        "
      />

      <div class="flex gap-2">
        <input
          :value="q"
          type="search"
          :placeholder="`Cari ${noun}…`"
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base"
          @input="onSearch(($event.target as HTMLInputElement).value)"
        />
        <button
          type="button"
          class="shrink-0 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white"
          @click="startCreate"
        >
          + Tambah
        </button>
      </div>

      <p v-if="listError" class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ listError }}
      </p>

      <p v-if="loading" class="mt-4 text-sm text-slate-500">Memuat…</p>

      <p
        v-else-if="!items.length"
        class="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500"
      >
        {{ q ? `Tidak ada ${noun} yang cocok.` : `Belum ada ${noun}. Tambahkan yang pertama.` }}
      </p>

      <ul v-else class="mt-4 space-y-2">
        <li
          v-for="item in items"
          :key="item.id"
          class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium text-slate-900">{{ item.name }}</p>
            <p class="truncate text-xs text-slate-500">
              {{ formatRupiah(item.price) }} · /{{ item.slug }}
            </p>
          </div>
          <button
            type="button"
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium"
            @click="startEdit(item)"
          >
            Ubah
          </button>
          <button
            type="button"
            class="rounded-md px-2 py-1.5 text-sm text-red-600"
            :disabled="busy"
            @click="remove(item)"
          >
            Hapus
          </button>
        </li>
      </ul>
    </template>
  </div>
</template>
