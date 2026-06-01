import { BookOpen, Heart, Users, Globe } from "lucide-react";
import cardBg01 from "@/assets/lideres/card-bg-01.webp";
import cardBg02 from "@/assets/lideres/card-bg-02.webp";
import cardBg03 from "@/assets/lideres/card-bg-03.webp";
import cardBgJmj from "@/assets/lideres/jmj-seul-2027.jpg";

const WHATSAPP_URL =
  "https://wa.me/5519998947307?text=Ol%C3%A1!%20Vim%20do%20site%20e%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es.";

const cards = [
  {
    image: cardBg01,
    icon: BookOpen,
    title: "A fé ganha vida",
    description:
      "Ler as Escrituras e conhecer a história da Igreja é poderoso. Mas caminhar pelos lugares sagrados, visitar santuários e percorrer rotas de fé transforma a vivência espiritual. A tradição deixa de ser apenas estudada e passa a ser experimentada.",
    alt: "Cúpula da Rocha e Muro das Lamentações em Jerusalém",
  },
  {
    image: cardBg02,
    icon: Heart,
    title: "Renovação espiritual",
    description:
      "É o momento de desconectar do mundo e conectar com o sagrado. Peregrinações são momentos de avivamento, onde os irmãos retornam com um propósito renovado e uma fé inabalável.",
    alt: "Santuário de Fátima em Portugal",
  },
  {
    image: cardBg03,
    icon: Users,
    title: "União e comunhão",
    description:
      "A experiência compartilhada de viajar e orar juntos cria laços eternos entre os membros do grupo. Sua comunidade volta mais unida, mais forte e com histórias que serão contadas por gerações.",
    alt: "Basílica de São Pedro no Vaticano",
  },
  {
    image: cardBgJmj,
    icon: Globe,
    title: "JMJ 2027 — Seul",
    description:
      "Leve sua juventude à Jornada Mundial da Juventude em Seul, Coreia do Sul. Uma experiência única de fé, cultura e encontro com o Papa. Pacotes especiais para grupos paroquiais com acompanhamento completo.",
    alt: "Seoul cityscape with JMJ 2027 pilgrimage",
  },
];

const JornadaCards = () => {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-foreground text-center max-w-3xl mx-auto mb-14 tracking-tight leading-tight">
          Uma jornada que vai marcar a{" "}
          <span className="text-secondary">vida espiritual da sua igreja</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 max-w-7xl mx-auto mb-12">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <article
                key={i}
                className="group relative bg-card rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
              >
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={card.image}
                    alt={card.alt}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-transparent to-primary/40" />
                </div>

                <div className="relative p-6 pt-12 flex-1 flex flex-col">
                  <div className="absolute -top-8 left-6 w-16 h-16 rounded-full bg-secondary flex items-center justify-center shadow-xl ring-4 ring-card z-10">
                    <Icon className="w-8 h-8 text-secondary-foreground" strokeWidth={2} />
                  </div>
                  <h3 className="font-heading text-xl md:text-2xl font-bold text-primary uppercase mb-3 tracking-tight">
                    {card.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        <div className="text-center">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#25D366] hover:bg-[#20bd5a] text-white font-heading font-bold uppercase tracking-wide px-10 py-4 transition-all hover:scale-105 shadow-lg rounded-full"
          >
            Conversar no WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
};

export default JornadaCards;
