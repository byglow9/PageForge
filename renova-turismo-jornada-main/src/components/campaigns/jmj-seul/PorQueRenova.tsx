import { Shield, Heart, Users, Star, Compass } from "lucide-react";

const reasons = [
  { icon: Heart, title: "Experiências de Fé", text: "Cada roteiro é pensado para proporcionar momentos marcantes de espiritualidade." },
  { icon: Compass, title: "Guias Especializados", text: "Acompanhamento de guias com formação católica e conhecimento cultural." },
  { icon: Shield, title: "Segurança Total", text: "Cuidamos de cada detalhe para você viajar e peregrinar com tranquilidade." },
  { icon: Users, title: "Cuidado com o Grupo", text: "Acompanhamento próximo dos jovens e responsáveis durante toda a Jornada." },
  { icon: Star, title: "Experiência Comprovada", text: "Líder no segmento de Turismo religioso e em grupos, com mais de 20 anos no mercado." },
];

const PorQueRenova = () => {
  return (
    <section className="py-12 md:py-28 bg-primary">
      <div className="container mx-auto px-4">
        <p className="font-accent text-lg italic text-secondary text-center mb-2">
          Viaje com quem entende de peregrinações
        </p>
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary-foreground text-center mb-14">
          Por Que a Renova Turismo
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {reasons.slice(0, 3).map((r) => (
            <div key={r.title} className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-6 text-center hover:bg-primary-foreground/15 transition-colors">
              <r.icon className="mx-auto mb-4 text-secondary" size={32} />
              <h3 className="font-heading font-semibold text-primary-foreground mb-2">{r.title}</h3>
              <p className="font-body text-primary-foreground/70 text-sm">{r.text}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-6 justify-center max-w-5xl mx-auto mt-6">
          {reasons.slice(3).map((r) => (
            <div key={r.title} className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-6 text-center hover:bg-primary-foreground/15 transition-colors sm:w-[calc(33.333%-0.5rem)]">
              <r.icon className="mx-auto mb-4 text-secondary" size={32} />
              <h3 className="font-heading font-semibold text-primary-foreground mb-2">{r.title}</h3>
              <p className="font-body text-primary-foreground/70 text-sm">{r.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PorQueRenova;
