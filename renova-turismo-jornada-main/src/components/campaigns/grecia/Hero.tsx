import { useState, useEffect } from "react";
import { Instagram, Facebook, Youtube, ChevronLeft } from "lucide-react";

import heroImg from "@/assets/grecia/hero-santorini.jpg";
import egeuImg from "@/assets/grecia/egeu.jpg";
import atenasImg from "@/assets/grecia/atenas.jpg";
import mykonosImg from "@/assets/grecia/mykonos.jpg";

const floatingCards = [
  {
    image: egeuImg,
    title: "Ilhas Escondidas",
    description:
      "Enseadas de água cristalina e vilarejos preservados que poucos viajantes brasileiros conhecem.",
  },
  {
    image: atenasImg,
    title: "Cultura Milenar",
    description:
      "Da Acrópole aos oráculos de Delfos — caminhe pelos berços da filosofia, da democracia e da mitologia.",
  },
  {
    image: mykonosImg,
    title: "Mediterrâneo Vivo",
    description:
      "Pôr do sol em Santorini, moinhos de Mykonos e a culinária grega autêntica em cada parada.",
  },
];

const Hero = () => {
  const [active, setActive] = useState(1);
  const total = floatingCards.length;

  useEffect(() => {
    const id = setInterval(() => setActive((p) => (p + 1) % total), 5000);
    return () => clearInterval(id);
  }, [total]);

  const getOffset = (i: number) => {
    const diff = i - active;
    // wrap so |offset| <= floor(total/2)
    if (diff > total / 2) return diff - total;
    if (diff < -total / 2) return diff + total;
    return diff;
  };


  return (
    <section
      id="inicio"
      className="relative min-h-screen flex items-center overflow-hidden bg-[hsl(var(--grecia-deep))]"
    >
      <img
        src={heroImg}
        alt="Vista aérea de Santorini com mar Egeu turquesa"
        className="absolute inset-0 w-full h-full object-cover opacity-90"
        width={1920}
        height={1080}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--grecia-deep))]/85 via-[hsl(var(--grecia-deep))]/55 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--grecia-deep))]/70 via-transparent to-transparent" />

      {/* Ambient aurora blobs */}
      <div className="aurora-blob w-[420px] h-[420px] bg-secondary/50 -top-20 -left-20" aria-hidden="true" />
      <div className="aurora-blob w-[520px] h-[520px] bg-[hsl(199_90%_60%)]/30 bottom-[-160px] right-[-120px]" style={{ animationDelay: "-6s" }} aria-hidden="true" />


      {/* Social rail */}
      <div className="hidden md:flex absolute left-6 lg:left-10 top-1/2 -translate-y-1/2 flex-col gap-5 z-20">
        {[Instagram, Facebook, Youtube].map((Icon, i) => (
          <a
            key={i}
            href="#"
            className="text-primary-foreground/70 hover:text-secondary transition-colors"
            aria-label="social"
          >
            <Icon size={18} strokeWidth={1.5} />
          </a>
        ))}
      </div>

      {/* Dot grid decoration */}
      <div
        className="hidden lg:block absolute left-[32%] top-[22%] w-32 h-32 dot-grid opacity-60 z-10"
        aria-hidden="true"
      />

      <div className="relative z-10 container mx-auto px-5 md:px-12 lg:px-20 pt-32 md:pt-40 pb-20">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-12 items-center min-w-0">
          {/* Left: headline */}
          <div className="text-primary-foreground max-w-xl min-w-0">
            <p className="font-accent italic text-lg md:text-xl text-secondary mb-4 md:mb-6">
              Renova Turismo apresenta
            </p>
            <h1 className="font-heading uppercase leading-[0.92] tracking-tight text-[3.2rem] sm:text-6xl md:text-7xl lg:text-[5.5rem]">
              <span className="block">Explore</span>
              <span className="block">a Grécia</span>
              <span className="block display-outline">Eterna</span>
            </h1>
            <p className="font-body text-base md:text-lg text-primary-foreground/80 max-w-md mt-6 md:mt-8 leading-relaxed">
              Uma jornada entre deuses, ilhas e o azul mais profundo do Mediterrâneo —
              do esplendor de Atenas à magia das Cíclades.
            </p>

            <div className="flex items-center gap-5 mt-8 md:mt-10">
              <a
                href="#contato"
                className="inline-block bg-secondary hover:bg-secondary/90 text-secondary-foreground font-body uppercase tracking-[0.18em] text-xs md:text-sm font-semibold px-8 py-4 rounded-full transition-all hover:scale-105 shadow-xl"
              >
                Reservar Agora
              </a>
              <a
                href="#roteiro"
                className="font-body uppercase tracking-[0.18em] text-xs md:text-sm text-primary-foreground/80 hover:text-primary-foreground border-b border-primary-foreground/40 pb-1 transition-colors"
              >
                Ver Roteiro
              </a>
            </div>

            {/* Mobile social rail — inline */}
            <div className="md:hidden flex items-center gap-5 mt-8">
              {[Instagram, Facebook, Youtube].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="text-primary-foreground/70 hover:text-secondary transition-colors"
                  aria-label="social"
                >
                  <Icon size={18} strokeWidth={1.5} />
                </a>
              ))}
            </div>
          </div>

          {/* Right: floating cards — fan carousel on sm+, snap scroll on mobile */}
          <div className="-mx-5 md:mx-0 min-w-0">
            {/* Mobile: horizontal snap scroll */}
            <div className="sm:hidden flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-5 px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {floatingCards.map((c) => (
                <article
                  key={c.title}
                  className="bg-background/95 backdrop-blur-xl rounded-2xl overflow-hidden flex flex-col shrink-0 w-[78%] snap-start border border-white/40 shadow-[0_20px_50px_-15px_hsl(var(--primary)/0.5)]"
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    <img src={c.image} alt={c.title} loading="lazy" width={400} height={300} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-heading text-sm text-primary leading-tight mb-2 uppercase min-h-[2.6em] flex items-start">{c.title}</h3>
                    <p className="font-body text-xs text-muted-foreground leading-relaxed flex-1">{c.description}</p>
                    <a href="#sobre" className="mt-4 inline-block self-start bg-secondary hover:bg-secondary/90 text-secondary-foreground font-body uppercase tracking-widest text-[10px] font-semibold px-4 py-2 rounded-full transition-colors">Saiba mais</a>
                  </div>
                </article>
              ))}
            </div>

            {/* Desktop+: interactive fan carousel */}
            <div
              className="hidden sm:block relative mx-auto"
              style={{ height: "560px", perspective: "1400px" }}
              aria-label="Destaques da viagem"
            >
              {floatingCards.map((c, i) => {
                const offset = getOffset(i);
                const isActive = offset === 0;
                const abs = Math.abs(offset);
                const translateX = offset * 38; // % of card width
                const rotate = offset * 9;
                const scale = isActive ? 1 : 0.78;
                const blur = isActive ? 0 : 3;
                const opacity = isActive ? 1 : 0.82;
                const z = 30 - abs * 10;
                const translateY = isActive ? 0 : 28;

                return (
                  <article
                    key={c.title}
                    onClick={() => setActive(i)}
                    className={`absolute left-1/2 top-1/2 w-[78%] sm:w-[300px] md:w-[320px] lg:w-[340px] bg-background/95 backdrop-blur-xl rounded-2xl overflow-hidden flex flex-col border border-white/40 shadow-[0_30px_60px_-20px_hsl(var(--primary)/0.55)] cursor-pointer ${
                      isActive ? "" : "hover:opacity-80"
                    }`}
                    style={{
                      transform: `translate(-50%, -50%) translateX(${translateX}%) translateY(${translateY}px) rotate(${rotate}deg) scale(${scale})`,
                      filter: `blur(${blur}px)`,
                      opacity,
                      zIndex: z,
                      transformOrigin: "center bottom",
                      transition:
                        "transform 800ms cubic-bezier(0.22, 1, 0.36, 1), filter 600ms ease, opacity 600ms ease",
                      willChange: "transform, filter, opacity",
                    }}
                    aria-hidden={!isActive}
                  >
                    <div className="aspect-[4/3] overflow-hidden">
                      <img src={c.image} alt={c.title} loading="lazy" width={400} height={300} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-heading text-base text-primary leading-tight mb-2 uppercase min-h-[2.6em] flex items-start">{c.title}</h3>
                      <p className="font-body text-xs text-muted-foreground leading-relaxed flex-1">{c.description}</p>
                      <a
                        href="#sobre"
                        onClick={(e) => !isActive && e.preventDefault()}
                        tabIndex={isActive ? 0 : -1}
                        className="mt-4 inline-block self-start bg-secondary hover:bg-secondary/90 text-secondary-foreground font-body uppercase tracking-widest text-[10px] font-semibold px-4 py-2 rounded-full transition-colors"
                      >
                        Saiba mais
                      </a>
                    </div>
                  </article>
                );
              })}

              {/* Dots */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 z-40">
                {floatingCards.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    aria-label={`Ir para card ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      i === active ? "bg-secondary w-8" : "bg-primary-foreground/40 hover:bg-primary-foreground/60 w-4"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Chevron nav decoration */}
        <div className="hidden md:flex items-center justify-center gap-2 mt-12 text-primary-foreground/50">
          <ChevronLeft size={14} strokeWidth={2.5} />
          <ChevronLeft size={18} strokeWidth={2.5} />
          <ChevronLeft size={22} strokeWidth={2.5} />
          <ChevronLeft size={26} strokeWidth={2.5} />
        </div>
      </div>
    </section>
  );
};

export default Hero;

