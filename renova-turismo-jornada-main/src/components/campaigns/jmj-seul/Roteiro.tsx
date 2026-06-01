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
import heroSeoul from "@/assets/jmj-seul/hero.jpg";
import gyeongbokgungImg from "@/assets/jmj-seul/gyeongbokgung.jpg";
import myeongdongImg from "@/assets/jmj-seul/myeongdong-cathedral.jpg";
import bukchonImg from "@/assets/jmj-seul/bukchon.jpg";
import busanImg from "@/assets/jmj-seul/busan.jpg";
import jmjImg from "@/assets/jmj-seul/papamovel-jmj.webp.asset.json";

const WHATSAPP_URL =
  "https://api.whatsapp.com/send/?phone=5519998974721&text=Ol%C3%A1+Fabiola%21+Tenho+interesse+na+viagem+para+a+JMJ+Seul+2027+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.&type=phone_number&app_absent=0";

interface DayCard {
  day: string;
  title: string;
  description: string;
  highlight?: string;
}

interface Slide {
  image: string;
  imageAlt: string;
  region: string;
  days: DayCard[];
}

const slides: Slide[] = [
  {
    image: guarulhosImg,
    imageAlt: "Aeroporto de Guarulhos – partida para Seul",
    region: "São Paulo → Coreia",
    days: [
      {
        day: "1º Dia",
        title: "SÃO PAULO / COREIA-SEUL",
        description:
          "Apresentação no aeroporto internacional de São Paulo, em Guarulhos, para embarque com destino à Coreia — Seul. Voos com as devidas conexões.",
        highlight: "O início de uma jornada de fé até a JMJ na Coreia do Sul.",
      },
      {
        day: "2º Dia",
        title: "DIA DE VOO",
        description:
          "Dia de trâmites aéreos e conexões em direção a Seul, Coreia do Sul.",
        highlight: "Caminhando em direção a uma experiência de fé inesquecível.",
      },
    ],
  },
  {
    image: heroSeoul,
    imageAlt: "Skyline de Seul, Coreia do Sul",
    region: "Chegada em Seul",
    days: [
      {
        day: "3º Dia",
        title: "CHEGADA A SEUL",
        description:
          "Chegada ao moderno Aeroporto Internacional de Incheon, porta de entrada da Coreia do Sul. Após os trâmites de imigração e retirada de bagagens, recepção pelo guia local. Traslado ao hotel em Seul, cidade que combina tradição milenar com tecnologia de ponta. Jantar e hospedagem.",
        highlight: "Boas-vindas à Coreia do Sul, sede da JMJ 2027.",
      },
    ],
  },
  {
    image: gyeongbokgungImg,
    imageAlt: "Palácio Gyeongbokgung, Seul",
    region: "Seul — City Tour",
    days: [
      {
        day: "4º Dia",
        title: "SEUL — CITY TOUR",
        description:
          "Após o café da manhã, saída para um passeio encantador até a famosa Ilha de Nami, um dos destinos mais românticos da Coreia, conhecida por suas alamedas arborizadas e paisagens cinematográficas. Caminhada tranquila em meio à natureza. À tarde, visita à icônica N'Seoul Tower, no topo do Monte Namsan, com vista panorâmica espetacular e os tradicionais 'cadeados do amor'. Retorno ao hotel. Jantar e hospedagem. Retirada do Kit JMJ (contempla alojamento durante JMJ + transporte + alimentação).",
        highlight: "Ilha de Nami e N'Seoul Tower: natureza e cultura coreana em um único dia.",
      },
    ],
  },
  {
    image: myeongdongImg,
    imageAlt: "Catedral de Myeongdong, Seul",
    region: "JMJ Seul 2027",
    days: [
      {
        day: "5º ao 8º Dia",
        title: "SEUL — JMJ",
        description:
          "Café da manhã no hotel. Dias dedicados à programação oficial da Jornada Mundial da Juventude Seul 2027. Refeições e transporte por conta da JMJ. Retorno ao hotel para hospedagem.",
        highlight: "Viva intensamente os dias centrais da JMJ com jovens de todo o mundo.",
      },
    ],
  },
  {
    image: jmjImg.url,
    imageAlt: "Papa acenando para fiéis no papamóvel durante a JMJ",
    region: "JMJ e Missa com o Papa",
    days: [
      {
        day: "9º Dia",
        title: "JMJ E MISSA COM O PAPA",
        description:
          "Café da manhã no hotel. Dia dedicado à JMJ (refeições e transporte por conta da JMJ). Participação na Santa Missa com o Santo Padre, um dos momentos mais marcantes da Jornada. Retorno ao hotel para hospedagem.",
        highlight: "O encontro mais esperado: a Missa com o Papa Francisco.",
      },
    ],
  },
  {
    image: bukchonImg,
    imageAlt: "Vila tradicional Bukchon Hanok",
    region: "JMJ — Caminho Neocatecumenal",
    days: [
      {
        day: "10º Dia",
        title: "JMJ",
        description:
          "Café da manhã no hotel. Dia livre para atividades pessoais. Como sugestão, participação no encontro vocacional e nas atividades do Caminho Neocatecumenal, com a presença de Kiko Argüello, proporcionando um momento profundo de espiritualidade e discernimento vocacional. Jantar e hospedagem.",
        highlight: "Um momento profundo de espiritualidade com Kiko Argüello e o Caminho Neocatecumenal.",
      },
    ],
  },
  {
    image: guarulhosImg,
    imageAlt: "Aeroporto – retorno ao Brasil",
    region: "Seul → São Paulo",
    days: [
      {
        day: "11º Dia",
        title: "SEUL / SÃO PAULO",
        description:
          "Café da manhã no hotel. Em horário determinado, traslado ao aeroporto Internacional de Incheon para embarque com destino a São Paulo.",
        highlight: "Despedida da Coreia com a alma renovada pela experiência da JMJ.",
      },
      {
        day: "12º Dia",
        title: "SÃO PAULO",
        description:
          "Chegada ao aeroporto internacional de São Paulo, em Guarulhos. Trâmites de desembarque e fim dos serviços.",
        highlight: "Retorno ao Brasil após uma jornada de fé inesquecível.",
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
          Sua jornada, dia a dia
        </p>
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary text-center mb-4">
          Roteiro — JMJ Seul 2027
        </h2>
        <p className="font-body text-muted-foreground text-center max-w-2xl mx-auto mb-12 text-sm">
          12 dias percorrendo Seul, os principais momentos oficiais da Jornada Mundial da Juventude e experiências únicas na Coreia do Sul.
        </p>

        <div className="max-w-5xl mx-auto">
          <Carousel setApi={handleApi} opts={{ loop: false }} className="w-full">
            <CarouselContent className="items-start">
              {slides.map((slide, idx) => (
                <CarouselItem key={idx} className="h-auto">
                  <div className="relative rounded-xl overflow-hidden bg-card">
                    <div className="relative h-56 md:h-72 overflow-hidden">
                      {idx === 4 && (
                        <img
                          src={slide.image}
                          alt=""
                          aria-hidden="true"
                          className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl"
                        />
                      )}
                      <img
                        src={slide.image}
                        alt={slide.imageAlt}
                        className={`relative w-full h-full ${idx === 4 ? "object-contain" : "object-cover"}`}
                        loading="lazy"
                        width={1280}
                        height={768}
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
                              ★ {day.highlight}
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
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-secondary hover:bg-secondary/90 text-secondary-foreground font-heading font-bold text-lg px-12 py-4 rounded-full transition-all hover:scale-105 shadow-lg"
          >
            Receber Proposta
          </a>
        </div>
      </div>
    </section>
  );
};

export default Roteiro;
