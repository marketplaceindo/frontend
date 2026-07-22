<script setup lang="ts">
import { loginRequestSchema } from "@marketplaceindo/shared";

const { login } = useAuth();
const form = reactive({ email: "", password: "" });
const errors = ref<Record<string, string>>({});
const submitting = ref(false);
const dev = import.meta.dev;

async function onSubmit() {
  errors.value = {};
  const parsed = loginRequestSchema.safeParse(form);
  if (!parsed.success) {
    errors.value = zodFieldErrors(parsed.error.issues);
    return;
  }
  submitting.value = true;
  try {
    await login(parsed.data);
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
      <h1 class="text-center text-xl font-bold text-slate-900">Masuk ke MarketIndonesia</h1>
      <p class="mt-1 text-center text-sm text-slate-500">Kelola situs usahamu.</p>

      <form class="mt-6 space-y-4" novalidate @submit.prevent="onSubmit">
        <p v-if="errors._" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ errors._ }}
        </p>

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
          <span class="mb-1 block text-sm font-medium text-slate-700">Password</span>
          <input
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            :aria-invalid="!!errors.password"
          />
          <span v-if="errors.password" class="mt-1 block text-xs text-red-600">{{ errors.password }}</span>
        </label>

        <button
          type="submit"
          :disabled="submitting"
          class="w-full rounded-lg bg-teal-600 px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {{ submitting ? "Memproses…" : "Masuk" }}
        </button>
      </form>

      <p class="mt-4 text-center text-sm text-slate-600">
        Belum punya akun?
        <NuxtLink to="/register" class="font-semibold text-teal-700">Daftar gratis</NuxtLink>
      </p>

      <p v-if="dev" class="mt-4 rounded-md bg-slate-100 px-3 py-2 text-center text-xs text-slate-500">
        Demo (mock): <code>owner@demo.test</code> / <code>password123</code>
      </p>
    </div>
  </div>
</template>
