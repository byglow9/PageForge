import { MapPin, Calendar, BookOpen } from "lucide-react";

const SobreViagem = () => {
  return (
    <section id="sobre" className="py-12 md:py-28 bg-muted">
      <div className="container mx-auto px-4">
        <p className="font-accent text-lg italic text-secondary text-center mb-2">
          {/* EDITAR: Subtítulo */}
          Descubra o que nos espera
        </p>
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary text-center mb-12">
          Sobre a Viagem
        </h2>

        <div className="max-w-3xl mx-auto text-center mb-14">
          <p className="font-body text-muted-foreground text-lg leading-relaxed">
            {/* EDITAR: Descrição do destino */}
            O Leste Europeu reúne alguns dos cenários mais ricos da história e cultura do velho continente.
            Praças centenárias, castelos imponentes e ruas charmosas formam um roteiro repleto de descobertas — uma experiência única para quem busca tradição, beleza e bons momentos.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-card rounded-lg p-8 text-center shadow-sm hover:shadow-md transition-shadow">
            <Calendar className="mx-auto mb-4 text-secondary" size={36} />
            <h3 className="font-heading font-semibold text-primary mb-2">Data</h3>
            <p className="font-body text-muted-foreground text-sm">
              {/* EDITAR: Datas da viagem */}
              Saídas para 2026 e 2027
            </p>
          </div>
          <div className="bg-card rounded-lg p-8 text-center shadow-sm hover:shadow-md transition-shadow">
            <MapPin className="mx-auto mb-4 text-secondary" size={36} />
            <h3 className="font-heading font-semibold text-primary mb-2">Destinos</h3>
            <p className="font-body text-muted-foreground text-sm">
              {/* EDITAR: Cidades */}
              Budapeste, Bratislava, Viena e Praga — 4 destinos icônicos.
            </p>
          </div>
          <div className="bg-card rounded-lg p-8 text-center shadow-sm hover:shadow-md transition-shadow">
            <BookOpen className="mx-auto mb-4 text-secondary" size={36} />
            <h3 className="font-heading font-semibold text-primary mb-2">Significado</h3>
            <p className="font-body text-muted-foreground text-sm">
              {/* EDITAR: Significado espiritual/cultural */}
              Descubra marcos históricos, paisagens surpreendentes e a diversidade cultural de um dos destinos mais fascinantes do mundo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SobreViagem;
