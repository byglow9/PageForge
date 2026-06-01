import { ChevronDown } from "lucide-react";
import heroImage from "@/assets/hero-turkiye.webp";

const HubHero = () => {
  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden">
      <img
        src={heroImage}
        alt="Renova Turismo — Viagens pelo mundo"
        width={1920}
        height={1080}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/30" />

      <div className="relative z-10 container mx-auto px-4 pt-[6.75rem] pb-16 text-center">
        <p className="font-accent text-lg md:text-xl italic text-primary-foreground/80 mb-4 animate-fade-in-up">
          Transformando vidas através de viagens
        </p>
        <h1 className="font-heading text-4xl md:text-6xl lg:text-7xl font-extrabold text-primary-foreground leading-tight mb-6 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          Renova Turismo
        </h1>
        <p className="font-body text-lg md:text-xl text-primary-foreground/90 max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          Descubra nossas viagens exclusivas com roteiros cuidadosamente planejados, guias especializados e experiências inesquecíveis.
        </p>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <ChevronDown className="text-primary-foreground/80" size={36} />
      </div>
    </section>
  );
};

export default HubHero;
