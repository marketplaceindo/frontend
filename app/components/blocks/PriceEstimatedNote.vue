<script setup lang="ts">
/**
 * Penanda harga estimasi (keputusan D-14).
 *
 * Harga yang berasal dari fallback rantai kota WAJIB terlihat sebagai estimasi
 * di situs publik, bukan hanya di editor. Aturan yang tidak boleh dilanggar:
 * lebih baik tidak ada angka daripada angka salah tanpa penanda — harga salah
 * yang terlihat pasti membuat sales kehilangan deal, dan kerusakannya jauh
 * melebihi manfaat auto-fill.
 */
defineProps<{
  /** Kota yang diminta pembeli — inilah OTR yang belum kami punya. */
  cityName?: string;
  /** Kota sumber harga, bila diketahui. Ditampilkan agar angkanya bisa dinilai. */
  fromCity?: string;
  ringkas?: boolean;
}>();
</script>

<template>
  <!--
    Warnanya lewat token theme (`text-accent`), bukan palet tetap, supaya ikut
    cascade `theme_json` tenant. Justru karena itu penandanya TIDAK boleh
    bergantung pada warna: kata "Estimasi" ditulis tebal dan kalimatnya eksplisit,
    sehingga tetap terbaca sebagai peringatan pada palet tenant mana pun.
  -->
  <p
    class="text-text/80"
    :class="ringkas ? 'text-xs' : 'mt-1 text-sm'"
    data-price-estimated="true"
  >
    <span class="font-semibold text-accent">
      <span aria-hidden="true">≈</span> Estimasi<template v-if="fromCity">
        (harga {{ fromCity }})</template
      >
    </span>
    — hubungi kami untuk OTR<template v-if="cityName"> {{ cityName }}</template
    >.
  </p>
</template>
