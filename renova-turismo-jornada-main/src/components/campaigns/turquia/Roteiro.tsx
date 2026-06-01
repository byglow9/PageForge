import { useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";

import guarulhosImg from "@/assets/airport-family.webp";
import istanbulImg from "@/assets/padre-leudo/istanbul-skyline.jpg";
import capadociaImg from "@/assets/padre-leudo/capadocia.jpg";
import pamukkaleImg from "@/assets/padre-leudo/pamukkale-thermal-pools.jpg";
import laoduceiaImg from "@/assets/padre-leudo/laodiceia.webp";
import efesoImg from "@/assets/padre-leudo/efeso-ruins.jpg";
import pergamoImg from "@/assets/turquia/pergamo-asclepion.jpg";
import sardesImg from "@/assets/turquia/sardes-templo.jpg";
import bosforoImg from "@/assets/turquia/bosforo-cruzeiro.jpg";

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
    imageAlt: "Aeroporto de Guarulhos – partida para a Turquia",
    region: "São Paulo → Istambul",
    days: [
      {
        day: "1° Dia",
        title: "SÃO PAULO / ISTAMBUL",
        description:
          "Apresentação no aeroporto de Guarulhos para embarque com destino à Turquia, fazendo as devidas conexões.",
        highlight:
          "O início de uma jornada internacional repleta de descobertas culturais e experiências memoráveis.",
      },
      {
        day: "2° Dia",
        title: "ISTAMBUL",
        description:
          "Chegada a Istambul, recepção e traslado ao hotel. Jantar e hospedagem.",
        highlight:
          "Chegada à vibrante Istambul, cidade onde tradição e modernidade se encontram entre dois continentes.",
      },
    ],
  },
  {
    image: istanbulImg,
    imageAlt: "Mesquita Azul e Santa Sofia ao entardecer",
    region: "Istambul",
    days: [
      {
        day: "3° Dia",
        title: "ISTAMBUL",
        description:
          "Após o café da manhã, visitaremos Istambul, a única cidade no mundo situada em dois continentes. Visitaremos St. Sophia, a Mesquita Azul e o Hipódromo Romano, onde as revoltas bizantinas aconteceram. Visita ao famoso Grande Bazar, um mercado coberto do século XV, composto por 5 mil lojas, e considerado um dos primeiros centros comerciais do mundo. Retorno ao hotel para hospedagem e jantar.",
        highlight:
          "Um dia para mergulhar na grandiosidade da arquitetura otomana e no ritmo vibrante dos mercados históricos.",
      },
    ],
  },
  {
    image: pergamoImg,
    imageAlt: "Ruínas do Asclepion em Pérgamo",
    region: "Pérgamo →  Tiatira →  Izmir",
    days: [
      {
        day: "4° Dia",
        title: "ISTAMBUL / PÉRGAMO / TIATIRA / IZMIR",
        description:
          "Café da manhã. Viagem terrestre para a região de Izmir. Chegada em Pérgamo, onde visitaremos o centro de cura de Asclepion. À tarde, prosseguiremos para Tiatira, outra das Sete Igrejas. Visitaremos os restos de uma Basílica e outras ruínas do período romano. Continuação a Izmir. Traslado ao hotel para jantar e hospedagem.",
        highlight:
          "Duas das Sete Igrejas do Apocalipse em um único dia: Pérgamo e Tiatira revelam camadas da história cristã primitiva.",
      },
    ],
  },
  {
    image: efesoImg,
    imageAlt: "Ruínas da antiga cidade de Éfeso",
    region: "Izmir → Éfeso → Izmir",
    days: [
      {
        day: "5° Dia",
        title: "IZMIR / ÉFESO / IZMIR",
        description:
          "Após café da manhã, visita a Éfeso, cidade greco-romana bem preservada na Ásia Menor, que chegou a ter uma população de 250.000 habitantes e monopolizou a riqueza do Oriente Médio. Ela guarda tesouros como o impressionante Teatro Romano, que abrigava mais de 25.000 espectadores, a magnífica Biblioteca de Celso (terceira maior biblioteca do mundo antigo), o Templo de Adriano e a Rua de Mármore. Visita à casa da Virgem Maria. Visita à Basílica de São João. Chegada ao hotel para jantar e hospedagem.",
        highlight:
          "Éfeso é um dos sítios arqueológicos mais impressionantes do mundo, com ruínas que revelam a grandiosidade da Antiguidade.",
      },
    ],
  },
  {
    image: sardesImg,
    imageAlt: "Ruínas do Templo de Ártemis em Sardes",
    region: "Sardes →  Filadélfia →  Pamukkale\n",
    days: [
      {
        day: "6° Dia",
        title: "IZMIR / SARDES / FILADÉLFIA / PAMUKKALE",
        description:
          "Café da manhã e partida para Sardes, outra das Sete Igrejas mencionadas pelo apóstolo João. Prosseguindo, visitaremos Filadélfia, outro centro das congregações Cristãs, visitando as ruínas de uma cidade construída em II a.C. pelo Rei Eumenos. Depois de Filadélfia continuaremos até Pamukkale, onde visitaremos a antiga Hierápolis e o \"Castelo de Algodão\", verdadeira maravilha natural com sua cachoeira gigante, estalactites e piscinas naturais formadas ao longo dos séculos pela passagem de águas termais carregadas de sais calcários. Traslado ao hotel para jantar e hospedagem.",
        highlight:
          "Três das Sete Igrejas em um dia, culminando no espetáculo natural de Pamukkale.",
      },
    ],
  },
  {
    image: laoduceiaImg,
    imageAlt: "Sítio arqueológico de Laodiceia",
    region: "Laodiceia → Capadócia",
    days: [
      {
        day: "7° Dia",
        title: "PAMUKKALE / LAODICEIA / CAPADÓCIA",
        description:
          "Após o café da manhã, visitaremos o sítio arqueológico de Laodiceia. Viagem para a Capadócia. No caminho, visita a um Kervansaray do século XIII, que é uma fortificação usada como dormitório para os vendedores do antigo caminho da seda. Chegada ao final da tarde na Capadócia. Traslado ao hotel para jantar e hospedagem.",
        highlight:
          "Laodiceia completa o circuito das Sete Igrejas antes da travessia rumo à surpreendente Capadócia.",
      },
    ],
  },
  {
    image: capadociaImg,
    imageAlt: "Paisagem surreal da Capadócia com chaminés de fadas",
    region: "Capadócia → Istambul",
    days: [
      {
        day: "8° Dia",
        title: "CAPADÓCIA",
        description:
          "Após café da manhã, ao que desejarem iremos fazer o inesquecível voo de balão (passeio opcional e conforme condições climáticas). Visita à cidade subterrânea de Ozkonak. Em Avcilar e Guvercinlik, apreciação da paisagem fantástica das \"Chaminés de Fadas\". Visita aos Vales da Capadócia. A região apresenta uma paisagem fascinante e única, formada há 3 milhões de anos pela lava dos vulcões extintos Erciyes e Hasan. Retorno ao hotel para jantar e hospedagem.",
        highlight:
          "Dos vales às cidades subterrâneas, com a possibilidade do inesquecível voo de balão ao amanhecer.",
      },
      {
        day: "9° Dia",
        title: "CAPADÓCIA / ISTAMBUL",
        description:
          "Após café da manhã, visita à Vila de Uçhisar, aldeia troglodita, no ponto mais alto da Capadócia. Visita ao vale de Göreme, para conhecer os mosteiros e as igrejas escavados na rocha vulcânica, decoradas com afrescos do século X e XI que mostram cenas bíblicas e imagens de São Jorge. Traslado ao aeroporto da Capadócia para embarque em voo com destino a Istambul. Traslado ao hotel para jantar e hospedagem.",
        highlight:
          "Göreme revela uma herança bizantina impressionante esculpida na rocha vulcânica.",
      },
    ],
  },
  {
    image: bosforoImg,
    imageAlt: "Passeio de barco pelo Bósforo em Istambul",
    region: "Istambul → São Paulo",
    days: [
      {
        day: "10° Dia",
        title: "ISTAMBUL",
        description:
          "Café da manhã. Passeio de barco pelo Bósforo. Nesse cruzeiro pelo Estreito de Bósforo teremos uma ótima vista dos palácios de Dolmabahce, Ciragan, Beylerbeyi e a Fortaleza de Rumeli Hisari. Na parte da tarde, visita ao Palácio de Topkapi, antiga residência dos Sultões Otomanos. Conheceremos o Bazar de Especiarias. No final da tarde retorno ao hotel para jantar e hospedagem.",
        highlight:
          "Entre o Bósforo e os palácios históricos, um roteiro que revela as paisagens urbanas mais icônicas da Turquia.",
      },
      {
        day: "11° Dia",
        title: "ISTAMBUL / SÃO PAULO",
        description:
          "Em horário combinado, traslado ao aeroporto de Istambul para embarque em voo com destino a São Paulo, fazendo as devidas conexões. Fim dos nossos serviços.",
        highlight:
          "Retorno para casa com bagagem cheia de memórias e experiências inesquecíveis da Turquia.",
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
          Sua viagem pela Turquia, dia a dia
        </p>
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary text-center mb-4">
          Roteiro — Cidades
        </h2>
        <p className="font-body text-muted-foreground text-center max-w-2xl mx-auto mb-12 text-sm">
          11 dias explorando cidades históricas, paisagens icônicas e alguns dos cenários mais marcantes da Turquia.
        </p>

        <div className="max-w-5xl mx-auto">
          <Carousel
            setApi={handleApi}
            opts={{ loop: false }}
            className="w-full"
          >
            <CarouselContent className="items-start">
              {slides.map((slide, idx) => (
                <CarouselItem key={idx} className="h-auto">
                  <div className="relative rounded-xl overflow-hidden bg-card">
                    <div className="relative h-56 md:h-72 overflow-hidden">
                      <img
                        src={slide.image}
                        alt={slide.imageAlt}
                        className="w-full h-full object-cover"
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
                              Destaque: {day.highlight}
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
            href="https://api.whatsapp.com/send/?phone=5519989542633&text=Ol%C3%A1%21+Encontrei+voc%C3%AAs+pelo+Google+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.+Aguardo+retorno&type=phone_number&app_absent=0"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-secondary hover:bg-secondary/90 text-secondary-foreground font-heading font-bold text-lg px-12 py-4 rounded-full transition-all hover:scale-105 shadow-lg"
          >
            Garanta Sua Vaga na Viagem
          </a>
        </div>
      </div>
    </section>
  );
};

export default Roteiro;
