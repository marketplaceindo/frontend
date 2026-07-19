<script setup lang="ts">
import { leadPayloadSchema, type Block, type CreateLeadResponse } from "@marketplaceindo/shared";
import { useForm } from "vee-validate";

type Data = Extract<Block, { type: "test_drive" }>["data"];
const props = defineProps<{ data: Data }>();

/**
 * Form lead test drive — tervalidasi dua arah:
 * client: vee-validate + leadPayloadSchema shared (adapter app/utils/vv-zod);
 * server: /api/leads memvalidasi ulang dengan createLeadRequestSchema (§1.4).
 */
const { defineField, handleSubmit, errors, setErrors, isSubmitting } = useForm({
  validationSchema: zodTypedSchema(leadPayloadSchema),
  initialValues: { name: "", phone: "", date: "", message: "" },
});

const [name, nameAttrs] = defineField("name");
const [phone, phoneAttrs] = defineField("phone");
const [date, dateAttrs] = defineField("date");
const [message, messageAttrs] = defineField("message");

const sukses = ref(false);
const gagalUmum = ref<string | null>(null);

const onSubmit = handleSubmit(async (values) => {
  gagalUmum.value = null;
  try {
    await $fetch<CreateLeadResponse>("/api/leads", {
      method: "POST",
      body: {
        type: "test_drive",
        payload: {
          name: values.name,
          phone: values.phone,
          ...(values.date ? { date: values.date } : {}),
          ...(values.message ? { message: values.message } : {}),
        },
        ...(props.data.vehicleSlug ? { sourceItemSlug: props.data.vehicleSlug } : {}),
      },
    });
    sukses.value = true;
  } catch (err) {
    // Map fieldErrors server (dot-notation §1.4, prefix "payload.") → field form.
    const data = (err as { data?: { data?: { error?: { fieldErrors?: Record<string, string[]> } } } })
      .data?.data?.error;
    if (data?.fieldErrors) {
      const mapped: Record<string, string> = {};
      for (const [path, messages] of Object.entries(data.fieldErrors)) {
        mapped[path.replace(/^payload\./, "")] = messages[0] ?? "Tidak valid";
      }
      setErrors(mapped);
    } else {
      gagalUmum.value = "Gagal mengirim. Coba lagi beberapa saat lagi.";
    }
  }
});
</script>

<template>
  <div class="section-inner max-w-xl py-8 md:py-12">
    <h2 class="text-2xl font-bold md:text-3xl">{{ data.heading ?? "Jadwalkan Test Drive" }}</h2>
    <p v-if="data.description" class="mt-2 text-sm opacity-80">{{ data.description }}</p>

    <p
      v-if="sukses"
      class="mt-6 rounded-theme border border-primary/40 bg-primary/10 p-4 text-sm font-medium"
      data-testid="test-drive-sukses"
    >
      Terima kasih! Permintaan test drive kamu sudah kami terima — sales kami akan
      menghubungi via WhatsApp.
    </p>

    <form v-else class="mt-6 space-y-4" novalidate @submit="onSubmit">
      <label class="block text-sm">
        <span class="mb-1 block font-medium">Nama</span>
        <input
          v-model="name"
          v-bind="nameAttrs"
          name="name"
          type="text"
          class="w-full rounded-theme border border-text/20 bg-bg px-3 py-2"
          :aria-invalid="!!errors.name"
        />
        <span v-if="errors.name" class="mt-1 block text-xs text-secondary">{{ errors.name }}</span>
      </label>

      <label class="block text-sm">
        <span class="mb-1 block font-medium">No. HP / WhatsApp</span>
        <input
          v-model="phone"
          v-bind="phoneAttrs"
          name="phone"
          type="tel"
          inputmode="tel"
          placeholder="08xxxxxxxxxx"
          class="w-full rounded-theme border border-text/20 bg-bg px-3 py-2"
          :aria-invalid="!!errors.phone"
        />
        <span v-if="errors.phone" class="mt-1 block text-xs text-secondary">{{ errors.phone }}</span>
      </label>

      <label class="block text-sm">
        <span class="mb-1 block font-medium">Tanggal diinginkan (opsional)</span>
        <input
          v-model="date"
          v-bind="dateAttrs"
          name="date"
          type="date"
          class="w-full rounded-theme border border-text/20 bg-bg px-3 py-2"
        />
      </label>

      <label class="block text-sm">
        <span class="mb-1 block font-medium">Pesan (opsional)</span>
        <textarea
          v-model="message"
          v-bind="messageAttrs"
          name="message"
          rows="3"
          class="w-full rounded-theme border border-text/20 bg-bg px-3 py-2"
        />
      </label>

      <p v-if="gagalUmum" class="text-sm text-secondary">{{ gagalUmum }}</p>

      <button type="submit" :class="ctaClass('primary')" :disabled="isSubmitting">
        {{ isSubmitting ? "Mengirim…" : "Kirim Permintaan" }}
      </button>
    </form>
  </div>
</template>
