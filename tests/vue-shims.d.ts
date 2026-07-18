// Shim untuk project TS tests (di luar graph .nuxt yang sudah punya shim sendiri).

// import.meta.dev disediakan Nuxt/Vite; di project tests cukup diketik opsional.
interface ImportMeta {
  readonly dev?: boolean;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}
