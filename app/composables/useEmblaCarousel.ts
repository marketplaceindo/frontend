import EmblaCarousel from "embla-carousel";
import Autoplay from "embla-carousel-autoplay";
import { ref, onMounted, onBeforeUnmount, type Ref } from "vue";

interface Options {
  loop?: boolean;
  autoPlayMs?: number;
}

export function useEmblaCarousel(containerRef: Ref<HTMLElement | null>, opts: Options = {}) {
  const selectedIndex = ref(0);
  const scrollSnaps = ref<number[]>([]);
  let embla: ReturnType<typeof EmblaCarousel> | null = null;

  const scrollTo = (index: number) => embla?.scrollTo(index);
  const scrollPrev = () => embla?.scrollPrev();
  const scrollNext = () => embla?.scrollNext();

  onMounted(() => {
    if (!containerRef.value) return;

    const plugins = opts.autoPlayMs && opts.autoPlayMs > 0
      ? [Autoplay({ delay: opts.autoPlayMs, stopOnInteraction: true })]
      : [];

    embla = EmblaCarousel(containerRef.value, { loop: opts.loop ?? true }, plugins);

    const onSelect = () => {
      selectedIndex.value = embla!.selectedScrollSnap();
    };
    embla.on("select", onSelect);
    embla.on("init", () => {
      scrollSnaps.value = embla!.scrollSnapList();
      onSelect();
    });
  });

  onBeforeUnmount(() => {
    embla?.destroy();
  });

  return { selectedIndex, scrollSnaps, scrollTo, scrollPrev, scrollNext };
}
