<script setup lang="ts">
import { registerRequestSchema } from "@marketplaceindo/shared";

const { register } = useAuth();
const form = reactive({ name: "", email: "", whatsapp: "", password: "" });
const errors = ref<Record<string, string>>({});
const submitting = ref(false);

async function onSubmit() {
  errors.value = {};
  const payload = {
    name: form.name,
    email: form.email,
    password: form.password,
    ...(form.whatsapp ? { whatsapp: form.whatsapp } : {}),
  };
  const parsed = registerRequestSchema.safeParse(payload);
  if (!parsed.success) {
    errors.value = zodFieldErrors(parsed.error.issues);
    return;
  }
  submitting.value = true;
  try {
    await register(parsed.data);
    await navigateTo("/", { replace: true });
  } catch (err) {
    const e = apiErrorOf(err);
    errors.value = e.fieldErrors
      ? Object.fromEntries(Object.entries(e.fieldErrors).map(([k, v]) => [k, v[0] ?? ""]))
      : { _: e.message };
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
    <div class="w-full max-w-sm">
      <h1 class="text-center text-xl font-bold text-slate-900">Daftar gratis</h1>
      <p class="mt-1 text-center text-sm text-slate-500">
        Coba dulu, bayar nanti saat situs siap terbit.
      </p>

      <form class="mt-6 space-y-4" novalidate @submit.prevent="onSubmit">
        <p v-if="errors._" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ errors._ }}
        </p>

        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Nama</span>
          <input
            v-model="form.name"
            type="text"
            autocomplete="name"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            :aria-invalid="!!errors.name"
          />
          <span v-if="errors.name" class="mt-1 block text-xs text-red-600">{{ errors.name }}</span>
        </label>

        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Email</span>
          <input
            v-model="form.email"
            type="email"
            autocomplete="email"
            inputmode="email"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            :aria-invalid="!!errors.email"
          />
          <span v-if="errors.email" class="mt-1 block text-xs text-red-600">{{ errors.email }}</span>
        </label>

        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">
            WhatsApp <span class="font-normal text-slate-400">(opsional)</span>
          </span>
          <input
            v-model="form.whatsapp"
            type="tel"
            inputmode="tel"
            placeholder="6281234567890"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            :aria-invalid="!!errors.whatsapp"
          />
          <span v-if="errors.whatsapp" class="mt-1 block text-xs text-red-600">{{ errors.whatsapp }}</span>
        </label>

        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Password</span>
          <input
            v-model="form.password"
            type="password"
            autocomplete="new-password"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            :aria-invalid="!!errors.password"
          />
          <span v-if="errors.password" class="mt-1 block text-xs text-red-600">{{ errors.password }}</span>
          <span v-else class="mt-1 block text-xs text-slate-400">Minimal 8 karakter.</span>
        </label>

        <button
          type="submit"
          :disabled="submitting"
          class="w-full rounded-lg bg-teal-600 px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {{ submitting ? "Memproses…" : "Daftar" }}
        </button>
      </form>

      <p class="mt-4 text-center text-sm text-slate-600">
        Sudah punya akun?
        <NuxtLink to="/login" class="font-semibold text-teal-700">Masuk</NuxtLink>
      </p>
    </div>
  </div>
</template>
