import { useState } from "react";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";

const WHATSAPP_URL =
  "https://wa.me/5519998947307?text=Ol%C3%A1!%20Vim%20do%20site%20e%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es.";

const TESTIMONIALS = [
  {
    name: "Padre João Silva",
    role: "Paróquia São José",
    quote:
      "A Renova Turismo organizou nossa peregrinação à Terra Santa com muito cuidado e profissionalismo. Cada detalhe foi pensado para que pudéssemos viver uma experiência espiritual profunda.",
  },
  {
    name: "Padre Antônio Souza",
    role: "Paróquia Nossa Senhora Aparecida",
    quote:
      "Levei meu grupo paroquial e voltamos transformados. Hospedagem, guias e roteiros impecáveis. Recomendo a todos os padres que desejam levar sua comunidade em uma jornada de fé.",
  },
];

/**
 * Lista de vídeos do carrossel de depoimentos.
 * Para adicionar um novo vídeo, basta inserir um novo objeto com:
 *  - id: identificador único
 *  - youtubeId: ID do vídeo no YouTube (parte final da URL)
 *  - title: título usado no atributo de acessibilidade do iframe
 */
const VIDEOS = [
  {
    id: "video-1",
    youtubeId: "rOrUkwVaq2A",
    title: "Depoimento de cliente Renova Turismo - 1",
  },
  {
    id: "video-2",
    youtubeId: "WXmnf9RUrs0",
    title: "Depoimento de cliente Renova Turismo - 2",
  },
  {
    id: "video-3",
    youtubeId: "58PAtRmP2wA",
    title: "Depoimento de cliente Renova Turismo - 3",
  },
];

const Depoimentos = () => {
  // loop:false e watchDrag mantém navegação manual; sem autoplay.
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "start" });
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Atualiza o índice selecionado quando o usuário navega.
  if (emblaApi) {
    emblaApi.on("select", () => setSelectedIndex(emblaApi.selectedScrollSnap()));
  }

  const scrollPrev = () => emblaApi?.scrollPrev();
  const scrollNext = () => emblaApi?.scrollNext();

  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4 max-w-5xl">
        <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-foreground text-center mb-14 tracking-tight leading-tight">
          A confiança de quem já{" "}
          <span className="text-secondary">viajou conosco</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-14">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="relative bg-card rounded-2xl shadow-lg border border-border p-8 flex flex-col"
            >
              <Quote className="text-secondary/30 mb-4" size={36} />
              <p className="font-body text-base md:text-lg text-foreground/90 leading-relaxed mb-6 flex-1">
                "{t.quote}"
              </p>
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="text-yellow-500 fill-yellow-500" size={16} />
                ))}
              </div>
              <div>
                <p className="font-heading font-semibold text-primary">{t.name}</p>
                <p className="font-body text-sm text-muted-foreground">{t.role}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Carrossel de vídeos - navegação manual */}
        <div className="max-w-3xl mx-auto mb-14">
          <div className="relative">
            <div className="overflow-hidden rounded-2xl shadow-lg border border-border" ref={emblaRef}>
              <div className="flex">
                {VIDEOS.map((video) => (
                  <div key={video.id} className="flex-[0_0_100%] min-w-0">
                    <div className="relative aspect-video bg-black">
                      <iframe
                        src={`https://www.youtube.com/embed/${video.youtubeId}?rel=0&modestbranding=1`}
                        title={video.title}
                        loading="lazy"
                        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                        className="absolute inset-0 w-full h-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Botão anterior */}
            <button
              type="button"
              onClick={scrollPrev}
              disabled={selectedIndex === 0}
              aria-label="Vídeo anterior"
              className="absolute left-2 md:-left-5 top-1/2 -translate-y-1/2 z-10 h-10 w-10 md:h-12 md:w-12 rounded-full bg-background/90 border border-border shadow-lg flex items-center justify-center text-primary hover:bg-background hover:scale-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Botão próximo */}
            <button
              type="button"
              onClick={scrollNext}
              disabled={selectedIndex === VIDEOS.length - 1}
              aria-label="Próximo vídeo"
              className="absolute right-2 md:-right-5 top-1/2 -translate-y-1/2 z-10 h-10 w-10 md:h-12 md:w-12 rounded-full bg-background/90 border border-border shadow-lg flex items-center justify-center text-primary hover:bg-background hover:scale-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Indicadores e contador */}
          <div className="flex flex-col items-center gap-3 mt-5">
            <div className="flex gap-2">
              {VIDEOS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => emblaApi?.scrollTo(i)}
                  aria-label={`Ir para o vídeo ${i + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    i === selectedIndex ? "w-8 bg-secondary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  }`}
                />
              ))}
            </div>
            <p className="font-body text-sm text-muted-foreground">
              {selectedIndex + 1} de {VIDEOS.length}
            </p>
          </div>
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

export default Depoimentos;
