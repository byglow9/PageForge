import { useEffect, useState } from "react";
import heroSlide2 from "@/assets/lideres/hero-slide-02.webp";
import heroSlide3 from "@/assets/lideres/hero-slide-03.webp";
import heroSlide4 from "@/assets/lideres/hero-slide-04.webp";
import heroSlide5 from "@/assets/lideres/hero-slide-05.webp";
import logoRenova from "@/assets/logo-renova.svg";
import { useYouTubeVolume } from "@/hooks/useYouTubeVolume";

const WHATSAPP_URL =
  "https://wa.me/5519998947307?text=Ol%C3%A1!%20Vim%20do%20site%20e%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es.";

const SLIDES = [
  { src: heroSlide2, alt: "Cúpula da Rocha e Muro das Lamentações em Jerusalém" },
  { src: heroSlide3, alt: "Basílica de Nossa Senhora de Guadalupe, México" },
  { src: heroSlide4, alt: "Basílica de São Pedro no Vaticano ao entardecer" },
  { src: heroSlide5, alt: "Santuário de Nossa Senhora de Lourdes, França" },
];

// Clona o primeiro slide ao final para permitir avanço contínuo sem retorno visual
const SLIDES_LOOP = [...SLIDES, SLIDES[0]];

const Hero = () => {
  const iframeRef = useYouTubeVolume(50);
  const [current, setCurrent] = useState(0);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setAnimate(true);
      setCurrent((c) => c + 1);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Quando chega ao clone (último), aguarda a transição terminar e reseta sem animação
  useEffect(() => {
    if (current === SLIDES.length) {
      const t = setTimeout(() => {
        setAnimate(false);
        setCurrent(0);
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [current]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div
          className={`flex h-full w-full ${animate ? "transition-transform duration-1000 ease-in-out" : ""}`}
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {SLIDES_LOOP.map((slide, i) => (
            <img
              key={i}
              src={slide.src}
              alt={slide.alt}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              decoding="async"
              width={1600}
              height={900}
              className="w-full h-full object-cover flex-shrink-0"
            />
          ))}
        </div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-primary/50 via-primary/45 to-primary/55" />

      <div className="relative z-10 container mx-auto px-4 py-20 text-center max-w-4xl">
        <img
          src={logoRenova}
          alt="Renova Turismo"
          className="h-14 md:h-16 mx-auto mb-8 animate-fade-in-up"
        />
        <h1
          className="font-heading text-3xl md:text-5xl lg:text-6xl font-extrabold text-primary-foreground leading-tight mb-6 animate-fade-in-up"
          style={{ animationDelay: "0.15s" }}
        >
          Padres:{" "}
          <span className="font-normal">
            Leve sua paróquia para uma peregrinação inesquecível
          </span>
        </h1>
        <p
          className="font-body text-lg md:text-xl text-primary-foreground max-w-2xl mx-auto mb-8 animate-fade-in-up"
          style={{ animationDelay: "0.3s" }}
        >
          Com a Renova, você leva o seu grupo para lugares sagrados com
          segurança, tradição e confiança.
        </p>

        <div
          className="max-w-xl mx-auto mb-10 animate-fade-in-up"
          style={{ animationDelay: "0.4s" }}
        >
          <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary-foreground/20 shadow-lg">
            <iframe
              ref={iframeRef}
              src="https://www.youtube.com/embed/lmWUiBtep3I?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=lmWUiBtep3I&enablejsapi=1"
              title="Peregrinação para Padres na Terra Santa - Renova Turismo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-[#25D366] hover:bg-[#20bd5a] text-white font-heading font-bold text-base md:text-lg uppercase tracking-wide px-10 py-4 transition-all hover:scale-105 shadow-lg animate-fade-in-up rounded-full"
          style={{ animationDelay: "0.45s" }}
        >
          Conversar no WhatsApp
        </a>
      </div>
    </section>
  );
};

export default Hero;
