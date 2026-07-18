import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

// Plugin vue diperlukan supaya test bisa meng-import modul yang memuat SFC
// (mis. app/utils/block-map.ts). Test tetap unit murni tanpa runtime Nuxt.
export default defineConfig({
  plugins: [vue()],
});
