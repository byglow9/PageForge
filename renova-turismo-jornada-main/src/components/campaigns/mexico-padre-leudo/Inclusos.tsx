import { Users, Coffee, Plane, Hotel, ShieldCheck, HeadphonesIcon } from "lucide-react";

const items = [
  {
    icon: Users,
    title: "Guias Especializados",
    text: "Guias locais falando Português, com profundo conhecimento cultural e histórico, para enriquecer cada momento da viagem.",
  },
  {
    icon: Coffee,
    title: "Refeições Incluídas",
    text: "Café da manhã e jantar todos os dias, para que você se preocupe apenas com o que realmente importa: a experiência da viagem.",
  },
  {
    icon: Plane,
    title: "Voos e Transfers",
    text: "Toda a logística de transporte está incluída — dos voos internacionais aos transfers entre cidades e hotéis, sem preocupações.",
  },
  {
    icon: Hotel,
    title: "Hotéis Categoria Turística Superior",
    text: "Hospedagem selecionada pelo conforto e localização privilegiada, garantindo descanso e praticidade após cada dia de descobertas.",
  },
  {
    icon: ShieldCheck,
    title: "Seguro Viagem Completo",
    text: "Cobertura total para que você viaje com a tranquilidade de estar protegido em todos os momentos.",
  },
  {
    icon: HeadphonesIcon,
    title: "Assistência 24 Horas",
    text: "Acompanhamento de um profissional da Renova Turismo durante toda a viagem, pronto para atender você a qualquer momento.",
  },
];

const Inclusos = () => {
  return (
    <section className="pt-12 md:pt-16 pb-12 md:pb-28 bg-background">
      <div className="container mx-auto px-4">
        <p className="font-accent text-lg italic text-secondary text-center mb-2">
          Tudo pensado para você
        </p>
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary text-center mb-4">
          O Que Está Incluso
        </h2>
        <p className="font-body text-muted-foreground text-center max-w-2xl mx-auto mb-14 leading-relaxed">
          Cada detalhe da sua viagem foi planejado com carinho e profissionalismo,
          para que você viva uma experiência única com total conforto e tranquilidade.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto justify-items-center">
          {items.slice(0, 6).map((item) => (
            <div
              key={item.title}
              className="bg-card rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow text-center"
            >
              <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center">
                <item.icon className="text-secondary" size={28} />
              </div>
              <h3 className="font-heading font-semibold text-primary mb-2">{item.title}</h3>
              <p className="font-body text-muted-foreground text-sm leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Inclusos;
