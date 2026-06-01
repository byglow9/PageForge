import { MapPin, Calendar, BookOpen } from "lucide-react";

const SobreViagem = () => {
  return (
    <section id="sobre" className="py-12 md:py-28 bg-transparent">
      <div className="container mx-auto px-4">
        <p className="font-accent text-lg italic text-primary-foreground/80 text-center mb-2">
          Descubra o que nos espera
        </p>
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary-foreground text-center mb-12">
          Sobre a Viagem
        </h2>

        <div className="max-w-3xl mx-auto text-center mb-14">
          <p className="font-body text-primary-foreground/90 text-lg leading-relaxed">
            Portugal encanta por sua rica história, arquitetura centenária, gastronomia
            incomparável e paisagens que vão do litoral atlântico às vinhas do Douro.
            Uma viagem que conecta tradição, fé e cultura em cada esquina.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-card/80 backdrop-blur-sm rounded-lg p-8 text-center shadow-sm hover:shadow-md transition-shadow">
            <Calendar className="mx-auto mb-4 text-secondary" size={36} />
            <h3 className="font-heading font-semibold text-primary mb-2">Data</h3>
            <p className="font-body text-muted-foreground text-sm">
              Outubro de 2026.
            </p>
          </div>
          <div className="bg-card/80 backdrop-blur-sm rounded-lg p-8 text-center shadow-sm hover:shadow-md transition-shadow">
            <MapPin className="mx-auto mb-4 text-secondary" size={36} />
            <h3 className="font-heading font-semibold text-primary mb-2">Destinos</h3>
            <p className="font-body text-muted-foreground text-sm">
              Lisboa, Sintra, Porto, Vale do Douro e Fátima — 5 destinos icônicos.
            </p>
          </div>
          <div className="bg-card/80 backdrop-blur-sm rounded-lg p-8 text-center shadow-sm hover:shadow-md transition-shadow">
            <BookOpen className="mx-auto mb-4 text-secondary" size={36} />
            <h3 className="font-heading font-semibold text-primary mb-2">Significado</h3>
            <p className="font-body text-muted-foreground text-sm">
              Uma jornada pela história dos Descobrimentos, a fé em Fátima e a cultura portuguesa que moldou o mundo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SobreViagem;
