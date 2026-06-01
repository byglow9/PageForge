import { useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";

import guarulhosImg from "@/assets/portugal/guarulhos-departure.webp";
import fatimaImg from "@/assets/portugal/fatima-santuario.webp";
import batalhaImg from "@/assets/portugal/batalha-mosteiro.webp";
import portoImg from "@/assets/portugal/porto-douro.webp";
import obidosImg from "@/assets/portugal/obidos-medieval.jpg";
import lisboaImg from "@/assets/portugal/lisboa-praca-comercio.webp";

interface DayCard {
  day: string;
  title: string;
  description: string;
  highlight?: string;
}

interface Slide {
  image: string;
  imageAlt: string;
  imagePosition?: string;
  region: string;
  days: DayCard[];
}

const slides: Slide[] = [
  {
    image: guarulhosImg,
    imageAlt: "Aeroporto de Guarulhos – partida para Portugal",
    region: "São Paulo → Lisboa → Fátima",
    days: [
      {
        day: "1° Dia",
        title: "SÃO PAULO / LISBOA",
        description:
          "Encontro no aeroporto internacional de Guarulhos para embarque em voo com destino a Lisboa fazendo as devidas conexões.",
        highlight:
          "O início de uma peregrinação especial rumo às terras de fé e história de Portugal.",
      },
      {
        day: "2° Dia",
        title: "LISBOA / FÁTIMA",
        description:
          "Chegada ao aeroporto de Lisboa. Após desembarque partida para Fátima. Hospedagem e jantar.",
        highlight:
          "Chegada a Portugal e partida direta para o coração da devoção mariana.",
      },
    ],
  },
  {
    image: fatimaImg,
    imageAlt: "Santuário de Nossa Senhora de Fátima",
    region: "Fátima",
    days: [
      {
        day: "3° Dia",
        title: "FÁTIMA",
        description:
          "Após café da manhã, visita ao Santuário de Fátima e o túmulo dos três pastorinhos. Visita a Capela das Aparições, onde Nossa Senhora apareceu aos três pastorinhos em 1917. Visita a Aljustrel, local onde residiam os pastorinhos. Acomodação e jantar. À noite procissão das velas.",
        highlight:
          "Local das aparições marianas de 1917, um dos maiores centros de peregrinação do mundo católico.",
      },
    ],
  },
  {
    image: batalhaImg,
    imageAlt: "Mosteiro da Batalha, Portugal",
    imagePosition: "center 30%",
    region: "Fátima → Nazaré → Batalha",
    days: [
      {
        day: "4° Dia",
        title: "FÁTIMA / NAZARÉ / BATALHA / FÁTIMA",
        description:
          "Café da manhã e partida em direção a Batalha para visita do Mosteiro da Batalha. Seguindo para a vila Nazaré para visita do Santuário de Nossa Senhora da Nazaré. Retorno ao hotel para jantar e hospedagem.",
        highlight:
          "O Mosteiro da Batalha, obra-prima do gótico português e Patrimônio da UNESCO, e o encantador Santuário da Nazaré.",
      },
    ],
  },
  {
    image: portoImg,
    imageAlt: "Cidade do Porto e Rio Douro",
    region: "Fátima → Porto",
    days: [
      {
        day: "5° Dia",
        title: "FÁTIMA / PORTO / FÁTIMA",
        description:
          "Após café da manhã, partida em direção ao Porto para visita panorâmica da cidade incluindo a Igreja de São Francisco, Palácio da Bolsa, Sé Catedral e passeio de barco pelo Rio Douro. Faremos também uma visita a uma cave de vinhos do porto e passeio de barco do Rio Douro. Retorno ao hotel para jantar e hospedagem.",
        highlight:
          "A Invicta revela sua arquitetura imponente e a tradição secular dos vinhos do Porto às margens do Douro.",
      },
    ],
  },
  {
    image: obidosImg,
    imageAlt: "Vila medieval de Óbidos",
    region: "Santarém → Óbidos → Lisboa",
    days: [
      {
        day: "6° Dia",
        title: "FÁTIMA / SANTARÉM / ÓBIDOS / LISBOA",
        description:
          "Café da manhã e continuação para Santarém, onde visitaremos o Milagre Eucarístico. Seguimos para Óbidos onde veremos as ruas estreitas e pequenas praças, a fim de conhecer essa belíssima cidade medieval. Prosseguimento para Lisboa. Acomodação e jantar.",
        highlight:
          "O Milagre Eucarístico de Santarém e o encanto medieval de Óbidos, uma das vilas mais pitorescas de Portugal.",
      },
    ],
  },
  {
    image: lisboaImg,
    imageAlt: "Bairro de Belém em Lisboa",
    region: "Lisboa",
    days: [
      {
        day: "7° Dia",
        title: "LISBOA",
        description:
          "Após o café da manhã, saída para visitarmos a cidade com especial destaque para o famoso bairro de Belém com os seus monumentos dedicados às descobertas. Oportunidade para quem quiser degustar um famoso pastel de Belém na fábrica original. Visita a Praça do Comércio e a Sé Catedral. Regresso ao hotel para hospedagem. Saída para assistir show de fados com jantar.",
        highlight:
          "Dos monumentos de Belém aos fados ao vivo, um dia completo pela alma e história de Lisboa.",
      },
    ],
  },
  {
    image: guarulhosImg,
    imageAlt: "Aeroporto – retorno ao Brasil",
    region: "Lisboa → São Paulo",
    days: [
      {
        day: "8° Dia",
        title: "LISBOA / SÃO PAULO",
        description:
          "Após o café da manhã, em horário a determinar, traslado para o aeroporto de Lisboa, para embarque com destino a São Paulo, com as devidas conexões.",
        highlight:
          "Despedida de Portugal com bagagem cheia de memórias, fé e experiências inesquecíveis.",
      },
      {
        day: "9° Dia",
        title: "SÃO PAULO",
        description:
          "Chegada no aeroporto de São Paulo, trâmites de desembarque e fim dos serviços.",
        highlight:
          "Retorno ao Brasil renovados pela peregrinação às terras de fé portuguesas.",
      },
    ],
  },
];

const Roteiro = () => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const count = slides.length;

  const onSelect = () => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
  };

  const handleApi = (newApi: CarouselApi) => {
    setApi(newApi);
    if (newApi) {
      newApi.on("select", onSelect);
      setCurrent(newApi.selectedScrollSnap());
    }
  };

  return (
    <section id="roteiro" className="pt-12 md:pt-28 pb-6 md:pb-10 bg-background">
      <div className="container mx-auto px-4">
        <p className="font-accent text-lg italic text-secondary text-center mb-2">
          Sua jornada de fé, dia a dia
        </p>
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary text-center mb-4">
          Roteiro — Cidades
        </h2>
        <p className="font-body text-muted-foreground text-center max-w-2xl mx-auto mb-12 text-sm">
          9 dias de peregrinação por Portugal, passando por Fátima, Nazaré, Batalha, Porto, Santarém, Óbidos e Lisboa.
        </p>

        <div className="max-w-5xl mx-auto">
          <Carousel setApi={handleApi} opts={{ loop: false }} className="w-full">
            <CarouselContent className="items-start">
              {slides.map((slide, idx) => (
                <CarouselItem key={idx} className="h-auto">
                  <div className="relative rounded-xl overflow-hidden bg-card">
                    <div className="relative h-56 md:h-72 overflow-hidden">
                      <img
                        src={slide.image}
                        alt={slide.imageAlt}
                        className="w-full h-full object-cover"
                        style={slide.imagePosition ? { objectPosition: slide.imagePosition } : undefined}
                        loading="lazy"
                        width={960}
                        height={640}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/30 to-transparent" />
                      <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
                        <div>
                          <span className="text-xs uppercase tracking-widest text-secondary font-body font-semibold">
                            {slide.days.map((d) => d.day).join(" — ")}
                          </span>
                          <h3 className="font-heading text-xl md:text-2xl font-bold text-primary-foreground mt-1">
                            {slide.region}
                          </h3>
                        </div>
                        <span className="text-primary-foreground/60 text-xs font-body">
                          {idx + 1} / {count}
                        </span>
                      </div>
                    </div>

                    <div className={`p-5 md:p-8 grid gap-6 ${slide.days.length > 1 ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
                      {slide.days.map((day) => (
                        <div
                          key={day.day}
                          className="border border-border rounded-lg p-5 bg-background hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="bg-secondary text-secondary-foreground text-xs font-heading font-bold px-3 py-1 rounded-full">
                              {day.day}
                            </span>
                            <h4 className="font-heading text-sm font-bold text-primary">
                              {day.title}
                            </h4>
                          </div>
                          <p className="font-body text-muted-foreground text-sm leading-relaxed mb-3">
                            {day.description}
                          </p>
                          {day.highlight && (
                            <p className="font-accent text-xs italic text-secondary/80 border-l-2 border-secondary/30 pl-3">
                              ✝ {day.highlight}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            <CarouselPrevious className="hidden md:flex -left-4 md:-left-12 bg-primary text-primary-foreground border-none hover:bg-primary/90" />
            <CarouselNext className="hidden md:flex -right-4 md:-right-12 bg-primary text-primary-foreground border-none hover:bg-primary/90" />
          </Carousel>

          <div className="flex justify-center gap-2 mt-3">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => api?.scrollTo(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  idx === current
                    ? "bg-secondary w-6"
                    : "bg-border hover:bg-muted-foreground/40"
                }`}
                aria-label={`Ir para slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="text-center mt-10">
          <a
            href="https://api.whatsapp.com/send/?phone=5519936186395&text=Ol%C3%A1!%20Gostaria%20de%20mais%20informa%C3%A7%C3%B5es%20sobre%20a%20viagem%20a%20Portugal.&type=phone_number&app_absent=0"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-secondary hover:bg-secondary/90 text-secondary-foreground font-heading font-bold text-lg px-12 py-4 rounded-full transition-all hover:scale-105 shadow-lg"
          >
            Conheça mais sobre o roteiro
          </a>
        </div>
      </div>
    </section>
  );
};

export default Roteiro;
