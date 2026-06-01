import { Users, Coffee, Plane, Hotel, ShieldCheck, Headphones } from "lucide-react";

const items = [
  {
    icon: Users,
    title: "Guias Especializados",
    text: "Guias locais falando português, com profundo conhecimento cultural e histórico, para enriquecer cada momento da viagem.",
  },
  {
    icon: Coffee,
    title: "Refeições Incluídas",
    text: "Café da manhã e jantar todos os dias, para que você se preocupe apenas com a experiência da viagem.",
  },
  {
    icon: Plane,
    title: "Voos e Transfers",
    text: "Toda a logística incluída — dos voos internacionais aos transfers entre cidades e hotéis, sem preocupações.",
  },
  {
    icon: Hotel,
    title: "Hotéis Turística Superior",
    text: "Hospedagem selecionada pelo conforto e localização privilegiada — descanso e praticidade após cada dia.",
  },
  {
    icon: ShieldCheck,
    title: "Seguro Viagem Completo",
    text: "Cobertura total para que você viaje com a tranquilidade de estar protegido em todos os momentos.",
  },
  {
    icon: Headphones,
    title: "Assistência 24 Horas",
    text: "Acompanhamento de um profissional da Renova Turismo durante toda a viagem, pronto para atender você.",
  },
];

const Inclusos = () => {
  return (
    <section className="py-16 md:py-28 bg-muted">
      <div className="container mx-auto px-5 md:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="font-accent italic text-lg text-secondary mb-3">
            Tudo pensado para você
          </p>
          <h2 className="font-heading uppercase text-3xl md:text-5xl text-primary leading-tight">
            O que está <span className="display-outline-dark">incluso</span>
          </h2>
          <div className="w-16 h-px bg-secondary mx-auto mt-6" />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {items.map((item) => (
            <div
              key={item.title}
              className="bg-background rounded-xl p-7 hover:shadow-xl transition-all hover:-translate-y-1 border border-border/40"
            >
              <div className="w-12 h-12 rounded-full bg-secondary/15 flex items-center justify-center mb-5">
                <item.icon className="text-secondary" size={22} strokeWidth={1.5} />
              </div>
              <h3 className="font-heading text-primary uppercase text-base mb-3 leading-tight">
                {item.title}
              </h3>
              <p className="font-body text-muted-foreground text-sm leading-relaxed">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Inclusos;
