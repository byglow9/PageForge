import { MapPin, Calendar, BookOpen } from "lucide-react";

const SobreViagem = () => {
  return (
    <section id="sobre" className="py-12 md:py-28 bg-muted">
      <div className="container mx-auto px-4">
        <p className="font-accent text-lg italic text-secondary text-center mb-2">
          Descubra o que nos espera
        </p>
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary text-center mb-12">
          Sobre a Viagem
        </h2>

        <div className="max-w-3xl mx-auto text-center mb-14">
          <p className="font-body text-muted-foreground text-lg leading-relaxed">
            O México é um dos destinos mais marcantes da fé católica no mundo — terra da Virgem
            de Guadalupe, berço de tradições milenares e palco de episódios históricos
            inesquecíveis. Nesta viagem exclusiva, a Renova Turismo convida você a percorrer
            santuários, cidades coloniais e paisagens deslumbrantes, unindo cultura e
            espiritualidade em uma experiência única.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-card rounded-lg p-8 text-center shadow-sm hover:shadow-md transition-shadow">
            <Calendar className="mx-auto mb-4 text-secondary" size={36} />
            <h3 className="font-heading font-semibold text-primary mb-2">Data</h3>
            <p className="font-body text-muted-foreground text-sm">
              17 de novembro a 26 de novembro de 2026
            </p>
          </div>
          <div className="bg-card rounded-lg p-8 text-center shadow-sm hover:shadow-md transition-shadow">
            <MapPin className="mx-auto mb-4 text-secondary" size={36} />
            <h3 className="font-heading font-semibold text-primary mb-2">Destinos</h3>
            <p className="font-body text-muted-foreground text-sm">
              Cidade do México, Guadalupe, Cancún e mais.
            </p>
          </div>
          <div className="bg-card rounded-lg p-8 text-center shadow-sm hover:shadow-md transition-shadow">
            <BookOpen className="mx-auto mb-4 text-secondary" size={36} />
            <h3 className="font-heading font-semibold text-primary mb-2">Significado</h3>
            <p className="font-body text-muted-foreground text-sm">
              Visite o Santuário de Nossa Senhora de Guadalupe e fortaleça sua fé na terra das aparições marianas.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SobreViagem;
