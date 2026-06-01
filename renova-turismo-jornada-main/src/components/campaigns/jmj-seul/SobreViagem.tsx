import { MapPin, Calendar, BookOpen } from "lucide-react";

const SobreViagem = () => {
  return (
    <section id="sobre" className="py-12 md:py-28 bg-muted">
      <div className="container mx-auto px-4">
        <p className="font-accent text-lg italic text-secondary text-center mb-2">
          Uma geração se encontra na Coreia
        </p>
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary text-center mb-12">
          Sobre a Viagem
        </h2>

        <div className="max-w-3xl mx-auto text-center mb-14">
          <p className="font-body text-muted-foreground text-lg leading-relaxed">
            A Jornada Mundial da Juventude de 2027 acontecerá em Seul, na Coreia do Sul —
            um encontro histórico que reunirá milhões de jovens católicos de todo o mundo
            ao lado do Santo Padre. Com a Renova Turismo, você vive esta experiência com
            segurança, acompanhamento espiritual e um roteiro pensado para unir fé, cultura
            e os principais cenários da Coreia.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-card rounded-lg p-8 text-center shadow-sm hover:shadow-md transition-shadow">
            <Calendar className="mx-auto mb-4 text-secondary" size={36} />
            <h3 className="font-heading font-semibold text-primary mb-2">Data</h3>
            <p className="font-body text-muted-foreground text-sm">
              31 de julho até 11 Agosto de 2027
            </p>
          </div>
          <div className="bg-card rounded-lg p-8 text-center shadow-sm hover:shadow-md transition-shadow">
            <MapPin className="mx-auto mb-4 text-secondary" size={36} />
            <h3 className="font-heading font-semibold text-primary mb-2">Destinos</h3>
            <p className="font-body text-muted-foreground text-sm">
              Seul: o cenário da Jornada Mundial da Juventude 2027 e berço
              de uma fé viva e profunda na Coreia do Sul.
            </p>
          </div>
          <div className="bg-card rounded-lg p-8 text-center shadow-sm hover:shadow-md transition-shadow">
            <BookOpen className="mx-auto mb-4 text-secondary" size={36} />
            <h3 className="font-heading font-semibold text-primary mb-2">Significado</h3>
            <p className="font-body text-muted-foreground text-sm">
              Caminhar com o Papa e milhões de jovens em uma das maiores celebrações de fé
              da Igreja Católica — um marco para a sua vida espiritual.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SobreViagem;
