<script setup lang="ts">
import type { User } from "@marketplaceindo/shared";
import DashboardLogin from "./DashboardLogin.vue";
import DashboardRegister from "./DashboardRegister.vue";
import DashboardHome from "./DashboardHome.vue";
import DashboardOnboarding from "./DashboardOnboarding.vue";
import DashboardCheckout from "./DashboardCheckout.vue";
import DashboardEditor from "./DashboardEditor.vue";

/**
 * Dispatcher dashboard (Fase 7a). Dirender oleh SiteEntry saat Host = mode
 * dashboard (app./www/apex), sehingga path dashboard (/login, /register, ...)
 * tidak pernah bocor ke Host tenant. Routing view berdasarkan path + sesi.
 */
const route = useRoute();
const user = useAuthUser();
const requestFetch = useRequestFetch();

// Restore sesi (SSR + client) dari cookie httpOnly via proxy /api/auth/me.
const { data: me } = await useAsyncData("dashboard-me", () =>
  requestFetch<{ user: User | null }>("/api/auth/me")
    .then((r) => r.user)
    .catch(() => null),
);
user.value = me.value ?? null;

const isAuthPage = computed(() => route.path === "/login" || route.path === "/register");

// Guard: halaman auth tak untuk yang sudah login; area dashboard butuh login.
function guardTarget(): string | null {
  if (isAuthPage.value) return user.value ? "/" : null;
  return user.value ? null : "/login";
}
const target = guardTarget();
if (target) await navigateTo(target, { replace: true });

const view = computed(() => {
  if (route.path === "/login") return "login";
  if (route.path === "/register") return "register";
  if (route.path === "/onboarding") return "onboarding";
  if (route.path === "/bayar-simulasi") return "checkout";
  if (route.path === "/editor") return "editor";
  return "home";
});

useSeoMeta({ robots: "noindex, nofollow" });
</script>

<template>
  <DashboardLogin v-if="view === 'login'" />
  <DashboardRegister v-else-if="view === 'register'" />
  <DashboardOnboarding v-else-if="view === 'onboarding' && user" />
  <DashboardCheckout v-else-if="view === 'checkout' && user" />
  <DashboardEditor v-else-if="view === 'editor' && user" />
  <DashboardHome v-else-if="user" />
</template>
