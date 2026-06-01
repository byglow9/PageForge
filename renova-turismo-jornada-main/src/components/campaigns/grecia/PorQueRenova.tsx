import { Heart, Compass, Shield, Users, Star } from "lucide-react";

const reasons = [
  { icon: Heart, title: "Experiências Únicas", text: "Cada roteiro é pensado para proporcionar momentos memoráveis e enriquecedores." },
  { icon: Compass, title: "Guias Especializados", text: "Acompanhamento de guias com conhecimento cultural e histórico." },
  { icon: Shield, title: "Segurança Total", text: "Cuidamos de cada detalhe para você viajar com tranquilidade." },
  { icon: Users, title: "Cuidado com o Grupo", text: "Independente da sua idade, você poderá desfrutar de todo o roteiro." },
  { icon: Star, title: "Experiência Comprovada", text: "Mais de 20 anos no mercado de viagens em grupo, com excelência reconhecida." },
];

const PorQueRenova = () => {
  return (
    <section className="py-16 md:py-28 bg-primary relative overflow-hidden noise-overlay">
      <div className="aurora-blob w-[460px] h-[460px] bg-secondary/40 -top-32 -left-24" aria-hidden="true" />
      <div className="aurora-blob w-[420px] h-[420px] bg-[hsl(199_90%_60%)]/30 bottom-[-160px] right-[-100px]" style={{ animationDelay: "-7s" }} aria-hidden="true" />
      <div
        className="absolute top-10 right-10 w-40 h-40 dot-grid opacity-30 hidden md:block"
        aria-hidden="true"
      />

      <div className="container mx-auto px-5 md:px-8 relative">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="font-accent italic text-lg text-secondary mb-3">
            Viaje com quem entende
          </p>
          <h2 className="font-heading uppercase text-3xl md:text-5xl text-primary-foreground leading-tight">
            Por que a <span className="display-outline">Renova</span>
          </h2>
          <div className="w-16 h-px bg-secondary mx-auto mt-6" />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {reasons.slice(0, 3).map((r) => (
            <div
              key={r.title}
              className="liquid-glass-dark rounded-2xl p-7 hover:-translate-y-1 transition-transform"
            >
              <r.icon className="text-secondary mb-5" size={26} strokeWidth={1.5} />
              <h3 className="font-heading uppercase text-base text-primary-foreground mb-3 leading-tight">
                {r.title}
              </h3>
              <p className="font-body text-primary-foreground/70 text-sm leading-relaxed">
                {r.text}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-5 justify-center max-w-5xl mx-auto mt-5">
          {reasons.slice(3).map((r) => (
            <div
              key={r.title}
              className="liquid-glass-dark rounded-2xl p-7 hover:-translate-y-1 transition-transform sm:w-[calc(33.333%-0.5rem)]"
            >
              <r.icon className="text-secondary mb-5" size={26} strokeWidth={1.5} />
              <h3 className="font-heading uppercase text-base text-primary-foreground mb-3 leading-tight">
                {r.title}
              </h3>
              <p className="font-body text-primary-foreground/70 text-sm leading-relaxed">
                {r.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PorQueRenova;
