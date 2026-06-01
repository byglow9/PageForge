import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

import atenasImg from "@/assets/grecia/atenas.jpg";
import delfosImg from "@/assets/grecia/delfos.jpg";
import meteoraImg from "@/assets/grecia/meteora.jpg";
import santoriniImg from "@/assets/grecia/hero-santorini.jpg";
import mykonosImg from "@/assets/grecia/mykonos.jpg";
import egeuImg from "@/assets/grecia/egeu.jpg";

interface Slide {
  image: string;
  imageAlt: string;
  region: string;
  regionEn: string;
  day: string;
  title: string;
  description: string;
  highlight?: string;
}

const slides: Slide[] = [
  {
    image: egeuImg,
    imageAlt: "Vista aérea de enseada grega com mar turquesa",
    region: "São Paulo → Atenas",
    regionEn: "Departure",
    day: "1º — 2º Dia",
    title: "GUARULHOS → ATENAS",
    description:
      "Apresentação no aeroporto internacional de Guarulhos (GRU) para embarque com destino a Atenas. Voos com as devidas conexões. Chegada à capital grega, recepção pelo guia local e traslado ao hotel.",
    highlight: "O início de uma jornada pelo berço da civilização ocidental.",
  },
  {
    image: atenasImg,
    imageAlt: "Partenon na Acrópole de Atenas ao entardecer",
    region: "Atenas",
    regionEn: "Athens",
    day: "3º Dia",
    title: "ATENAS — CITY TOUR",
    description:
      "Visita à Acrópole e ao Partenon, símbolos máximos da Grécia Antiga. Caminhada pelo bairro histórico de Plaka, Ágora Romana, Templo de Zeus Olímpico e Praça Syntagma. À tarde, tempo livre para explorar os cafés e tavernas locais.",
    highlight: "Acrópole, Partenon e o coração histórico de Atenas.",
  },
  {
    image: delfosImg,
    imageAlt: "Ruínas de Delfos com colunas e ciprestes",
    region: "Delfos",
    regionEn: "Delphi",
    day: "4º Dia",
    title: "ATENAS → DELFOS",
    description:
      "Saída rumo a Delfos, considerada na Antiguidade o \"umbigo do mundo\". Visita ao sítio arqueológico, ao Templo de Apolo e ao museu local. Paisagens deslumbrantes do Monte Parnaso ao longo do caminho.",
    highlight: "O oráculo mais sagrado da Grécia Antiga.",
  },
  {
    image: meteoraImg,
    imageAlt: "Mosteiros de Meteora sobre rochas com neblina",
    region: "Meteora",
    regionEn: "Meteora",
    day: "5º Dia",
    title: "DELFOS → METEORA",
    description:
      "Continuação até Kalambaka, base para visitar os impressionantes mosteiros de Meteora — construções ortodoxas suspensas sobre torres rochosas que parecem flutuar no céu. Patrimônio Mundial da UNESCO.",
    highlight: "Mosteiros suspensos entre o céu e a terra.",
  },
  {
    image: santoriniImg,
    imageAlt: "Casas brancas e cúpulas azuis de Santorini",
    region: "Santorini",
    regionEn: "Santorini",
    day: "6º — 7º Dia",
    title: "ATENAS → SANTORINI",
    description:
      "Voo doméstico até Santorini, a ilha mais icônica do Mar Egeu. Dias dedicados às vilas de Oia e Fira, vinícolas locais, praias vulcânicas e ao mundialmente famoso pôr do sol na caldeira.",
    highlight: "Pôr do sol em Oia — uma das vistas mais belas do mundo.",
  },
  {
    image: mykonosImg,
    imageAlt: "Moinhos de vento de Mykonos ao pôr do sol",
    region: "Mykonos",
    regionEn: "Mykonos",
    day: "8º — 9º Dia",
    title: "SANTORINI → MYKONOS",
    description:
      "Travessia em ferry até Mykonos. Exploração da Chora com seus moinhos, ruelas labirínticas e a Little Venice. Tempo livre para praias e a vibrante gastronomia mediterrânea.",
    highlight: "Os moinhos brancos e a alma cosmopolita do Egeu.",
  },
  {
    image: egeuImg,
    imageAlt: "Mar Egeu visto do alto, voo de retorno",
    region: "Mykonos → São Paulo",
    regionEn: "Return",
    day: "10º — 11º Dia",
    title: "MYKONOS → ATENAS → SÃO PAULO",
    description:
      "Em horário determinado, traslado ao aeroporto e voo de retorno com conexão em Atenas. Chegada a São Paulo-Guarulhos com memórias de uma vida.",
    highlight: "Memórias da Grécia eterna para levar pelo resto da vida.",
  },
];

const WHATSAPP =
  "https://api.whatsapp.com/send/?phone=5519992016125&text=Ol%C3%A1%21+Tenho+interesse+na+viagem+para+a+Gr%C3%A9cia+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.&type=phone_number&app_absent=0";

const Roteiro = () => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const count = slides.length;

  const handleApi = (newApi: CarouselApi) => {
    setApi(newApi);
    if (newApi) {
      newApi.on("select", () => setCurrent(newApi.selectedScrollSnap()));
      setCurrent(newApi.selectedScrollSnap());
    }
  };

  return (
    <section id="roteiro" className="py-16 md:py-28 bg-background">
      <div className="container mx-auto px-5 md:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="font-accent italic text-lg text-secondary mb-3">
            Sua jornada, dia a dia
          </p>
          <h2 className="font-heading uppercase text-3xl md:text-5xl text-primary leading-tight">
            Roteiro <span className="display-outline-dark">Grécia</span>
          </h2>
          <div className="w-16 h-px bg-secondary mx-auto mt-6" />
          <p className="font-body text-muted-foreground text-sm md:text-base mt-6 leading-relaxed">
            11 dias inesquecíveis: Atenas, Delfos, Meteora, Santorini e Mykonos.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <Carousel setApi={handleApi} opts={{ loop: false }} className="w-full">
            <CarouselContent className="items-start">
              {slides.map((slide, idx) => (
                <CarouselItem key={idx}>
                  <div className="grid md:grid-cols-2 gap-0 rounded-2xl overflow-hidden bg-muted shadow-xl">
                    <div className="relative h-64 md:h-auto md:min-h-[420px] overflow-hidden">
                      <img
                        src={slide.image}
                        alt={slide.imageAlt}
                        loading="lazy"
                        width={800}
                        height={600}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-muted/30" />
                      <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-primary-foreground">
                        <span className="font-body uppercase tracking-[0.2em] text-[10px] bg-secondary/95 px-3 py-1.5 rounded-full">
                          {slide.day}
                        </span>
                        <span className="font-body text-xs opacity-80">
                          {String(idx + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
                        </span>
                      </div>
                    </div>

                    <div className="p-7 md:p-10 flex flex-col justify-center">
                      <p className="font-accent italic text-secondary text-sm mb-2">
                        {slide.regionEn}
                      </p>
                      <h3 className="font-heading uppercase text-xl md:text-2xl text-primary leading-tight mb-1">
                        {slide.region}
                      </h3>
                      <div className="w-10 h-px bg-secondary my-5" />
                      <h4 className="font-heading text-primary text-sm mb-3">
                        {slide.title}
                      </h4>
                      <p className="font-body text-muted-foreground text-sm leading-relaxed mb-5">
                        {slide.description}
                      </p>
                      {slide.highlight && (
                        <p className="font-accent italic text-sm text-secondary/90 border-l-2 border-secondary/50 pl-3">
                          ✦ {slide.highlight}
                        </p>
                      )}
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          {/* Custom chevron controls */}
          <div className="flex items-center justify-between mt-8">
            <div className="flex gap-2">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => api?.scrollTo(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === current ? "bg-secondary w-8" : "bg-border w-4 hover:bg-muted-foreground/40"
                  }`}
                  aria-label={`Ir para slide ${idx + 1}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => api?.scrollPrev()}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-label="Anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => api?.scrollNext()}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-label="Próximo"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="text-center mt-14">
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-secondary hover:bg-secondary/90 text-secondary-foreground font-body uppercase tracking-[0.18em] text-xs md:text-sm font-semibold px-10 py-4 rounded-full transition-all hover:scale-105 shadow-lg"
          >
            Garanta Sua Vaga
          </a>
        </div>
      </div>
    </section>
  );
};

export default Roteiro;
