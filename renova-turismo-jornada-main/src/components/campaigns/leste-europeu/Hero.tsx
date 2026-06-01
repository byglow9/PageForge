import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";
import budapesteImg from "@/assets/leste-europeu/budapeste-ponte.webp";
import bratislavaImg from "@/assets/leste-europeu/bratislava.webp";
import vienaImg from "@/assets/leste-europeu/viena.webp";
import pragaImg from "@/assets/leste-europeu/praga.webp";
import { useYouTubeVolume } from "@/hooks/useYouTubeVolume";

const slides = [
  { src: budapesteImg, alt: "Ponte das Correntes e Basílica de Santo Estêvão, Budapeste, Hungria" },
  { src: bratislavaImg, alt: "Castelo de Bratislava sobre o rio Danúbio, Eslováquia" },
  { src: vienaImg, alt: "Hofburg, palácio imperial em Viena, Áustria" },
  { src: pragaImg, alt: "Castelo de Praga e Catedral de São Vito, República Tcheca" },
];

const Hero = () => {
  const iframeRef = useYouTubeVolume(50);
  const autoplay = useRef(Autoplay({ delay: 3800, stopOnInteraction: false, stopOnMouseEnter: true }));
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 35 }, [autoplay.current]);
  const [selected, setSelected] = useState( 0);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") scrollPrev();
      if (e.key === "ArrowRight") scrollNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrollPrev, scrollNext]);

  return (
    <section id="inicio" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0"
        ref={emblaRef}
        role="region"
        aria-roledescription="carrossel"
        aria-label="Imagens do Leste Europeu"
      >
        <div className="flex h-full">
          {slides.map((slide, i) => (
            <div
              key={slide.src}
              className="relative min-w-0 flex-[0_0_100%] h-full"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${slides.length}`}
            >
              <img
                src={slide.src}
                alt={slide.alt}
                className="absolute inset-0 w-full h-full object-cover"
                fetchPriority={i === 0 ? "high" : "low"}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                width={1920}
                height={1080}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-0 bg-black/45 pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 pt-[6.75rem] pb-16 text-center">
        <p className="font-accent text-lg md:text-xl italic text-primary-foreground/80 mb-4 animate-fade-in-up">
          Renova Turismo apresenta
        </p>
        <h1 className="font-heading text-3xl md:text-5xl lg:text-6xl font-extrabold text-primary-foreground leading-tight mb-6 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          Viagem ao Leste Europeu
        </h1>
        <p className="font-body text-lg md:text-xl text-primary-foreground/90 max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          Castelos medievais, capitais imperiais e paisagens encantadoras — viva uma jornada cultural inesquecível pelo Leste Europeu com a Renova Turismo.
        </p>

        <div className="max-w-xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.45s" }}>
          <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary-foreground/20 shadow-lg">
            <iframe
              ref={iframeRef}
              src="https://www.youtube.com/embed/TxLc7qjdNNg?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=TxLc7qjdNNg&enablejsapi=1"
              title="Viagem ao Leste Europeu - Renova Turismo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>

        <a
          href="https://api.whatsapp.com/send/?phone=5519989542633&text=Ol%C3%A1%2C+Rafael%21+Tenho+interesse+na+viagem+para+o+Leste+Europeu+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.&type=phone_number&app_absent=0"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-secondary hover:bg-secondary/90 text-secondary-foreground font-heading font-bold text-lg px-10 py-4 rounded-full transition-all hover:scale-105 shadow-lg animate-fade-in-up"
          style={{ animationDelay: "0.6s" }}
        >
          Saiba Mais
        </a>
      </div>

      {/* Controles */}
      <button
        type="button"
        onClick={scrollPrev}
        aria-label="Slide anterior"
        className="hidden md:flex absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-20 h-11 w-11 md:h-12 md:w-12 rounded-full bg-black/30 hover:bg-black/55 text-white backdrop-blur-sm border border-white/20 items-center justify-center transition-all hover:scale-105"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        type="button"
        onClick={scrollNext}
        aria-label="Próximo slide"
        className="hidden md:flex absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-20 h-11 w-11 md:h-12 md:w-12 rounded-full bg-black/30 hover:bg-black/55 text-white backdrop-blur-sm border border-white/20 items-center justify-center transition-all hover:scale-105"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* Indicadores */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => scrollTo(i)}
            aria-label={`Ir para slide ${i + 1}`}
            aria-current={selected === i}
            className={`h-2 rounded-full transition-all ${
              selected === i ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
            }`}
          />
        ))}
      </div>
    </section>
  );
};

export default Hero;
