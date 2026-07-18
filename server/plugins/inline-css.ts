/**
 * Inline stylesheet global (/_nuxt/entry.*.css) ke <style> di HTML SSR.
 * Tanpa ini first paint menunggu request CSS eksternal — dan sejak font
 * di-self-host, woff2 same-origin ikut berebut bandwidth dengan CSS tersebut
 * (skor Lighthouse mobile halaman publik jatuh). CSS ~17KB (4KB gzip) —
 * lebih murah di-inline daripada jadi request blocking.
 * Hanya aktif di produksi; dev dibiarkan (HMR Vite).
 */
const cssCache = new Map<string, string>();

export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev) return;

  nitroApp.hooks.hook("render:html", async (html) => {
    for (let i = 0; i < html.head.length; i++) {
      const chunk = html.head[i]!;
      if (!chunk.includes('rel="stylesheet"')) continue;

      const links = [...chunk.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="(\/_nuxt\/[^"]+\.css)"[^>]*>/g)];
      let replaced = chunk;
      for (const [tag, href] of links) {
        try {
          let css = cssCache.get(href!);
          if (css === undefined) {
            css = await $fetch<string>(href!, { responseType: "text" });
            cssCache.set(href!, css);
          }
          replaced = replaced.replace(tag, `<style>${css}</style>`);
        } catch {
          // Gagal baca asset → biarkan link asli (halaman tetap benar).
        }
      }
      html.head[i] = replaced;
    }
  });
});
