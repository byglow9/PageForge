import { useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";

import manausImg from "@/assets/padre-leudo/manaus-departure.jpg";
import istanbulImg from "@/assets/padre-leudo/istanbul-skyline.jpg";
import capadociaImg from "@/assets/padre-leudo/capadocia.jpg";
import konyaImg from "@/assets/padre-leudo/pamukkale-thermal-pools.jpg";
import pamukkaleImg from "@/assets/padre-leudo/laodiceia.webp";
import efesoImg from "@/assets/padre-leudo/efeso-ruins.jpg";
import bursaImg from "@/assets/padre-leudo/bursa.jpg";

interface DayCard {
  day: string;
  title: string;
  description: string;
  spiritual?: string;
}

interface Slide {
  image: string;
  imageAlt: string;
  region: string;
  days: DayCard[];
}

const slides: Slide[] = [
  {
    image: manausImg,
    imageAlt: "Partida de Manaus ao pôr do sol",
    region: "Manaus → Istambul",
    days: [
      {
        day: "1° Dia",
        title: "MANAUS / ISTAMBUL",
        description:
          "Apresentação no Aeroporto Internacional de Manaus para embarque com destino a Istambul, fazendo as devidas conexões. Noite e jantar a bordo.",
        spiritual:
          "O início de uma jornada de fé — como Abraão, partimos em obediência ao chamado de Deus rumo a terras sagradas.",
      },
      {
        day: "2° Dia",
        title: "ISTAMBUL",
        description:
          "Chegada a Istambul, traslado ao hotel para jantar e hospedagem.",
        spiritual:
          "Chegamos à antiga Constantinopla, berço do Cristianismo oriental e sede do Império que moldou a fé cristã.",
      },
    ],
  },
  {
    image: istanbulImg,
    imageAlt: "Mesquita Azul e Hagia Sophia ao entardecer",
    region: "Istambul",
    days: [
      {
        day: "3° Dia",
        title: "ISTAMBUL",
        description:
          "Após café da manhã, visitaremos a Praça do Hipódromo, construída na época romana. Seguiremos para a Mesquita Azul, a obra mais famosa da arquitetura otomana. Na parte da tarde, visitaremos o Palácio de Topkapi, antiga residência dos Sultões Otomanos. Nossa última parada será no Bazar de Especiarias.",
        spiritual:
          "A Mesquita Azul e o Hipódromo nos recordam como diferentes expressões de fé moldaram esta cidade milenar.",
      },
      {
        day: "4° Dia",
        title: "ISTAMBUL",
        description:
          "Passeio de barco pelo Bósforo com vista dos palácios de Dolmabahce, Ciragan, Beylerbeyi e a Fortaleza de Rumeli Hisari. Visita ao Palácio Dolmabahce e à Santa Sofia — Igreja durante 916 anos, Mesquita durante 477 anos, museu em 1936 e novamente Mesquita em 2020. Visita ao Gran Bazar.",
        spiritual:
          "A Hagia Sophia (Santa Sabedoria) foi o maior templo da Cristandade por quase um milênio — um testemunho da grandeza da fé.",
      },
    ],
  },
  {
    image: capadociaImg,
    imageAlt: "Paisagem surreal da Capadócia com chaminés de fadas",
    region: "Capadócia",
    days: [
      {
        day: "5° Dia",
        title: "ISTAMBUL / CAPADÓCIA",
        description:
          "Voo para a Capadócia. Visitaremos o Museu Aberto de Göreme, complexo monástico bizantino com igrejas ricamente ornadas com afrescos, quartos e refeitórios escavados na rocha. Parada em cooperativa de tapetes turcos.",
        spiritual:
          "Em Göreme, monges cristãos encontraram refúgio nas rochas e criaram igrejas subterrâneas que preservam afrescos bíblicos por mais de mil anos.",
      },
      {
        day: "6° Dia",
        title: "CAPADÓCIA",
        description:
          "Visita aos Vales da Capadócia com Chaminés de Fadas (possibilidade de passeio de balão). Exploração da cidade subterrânea de Ozkonak, com 40 metros de profundidade e 10 andares, capaz de abrigar 60 mil pessoas. Visita à Vila de Uchisar e ao Vale dos Pombos.",
        spiritual:
          "As cidades subterrâneas serviram de refúgio aos primeiros cristãos durante as perseguições — testemunho da perseverança na fé.",
      },
    ],
  },
  {
    image: konyaImg,
    imageAlt: "Monastério dos Derviches em Konya",
    region: "Konya → Pamukkale",
    days: [
      {
        day: "7° Dia",
        title: "CAPADÓCIA / KONYA / PAMUKKALE",
        description:
          "Saída para Konya para visitar o museu do antigo Monastério dos Derviches Dançarinos, fundado por Mevlana no século XIII. Almoço. Continuação a Pamukkale, famosa por suas águas termais e cascatas de cálcio petrificado formando montanhas brancas de algodão.",
        spiritual:
          "Em Konya contemplamos como a busca pela transcendência é universal — os Derviches buscam Deus através da dança contemplativa.",
      },
    ],
  },
  {
    image: pamukkaleImg,
    imageAlt: "Terraços brancos de Pamukkale",
    region: "Pamukkale & Laodiceia",
    days: [
      {
        day: "8° Dia",
        title: "PAMUKKALE / LAODICEIA",
        description:
          "Visita a Hierápolis, Patrimônio Mundial da UNESCO, com nascentes de água quentes e ruínas da antiga capital Frígia. Visita à Igreja de Laodiceia, uma das Sete Igrejas do Apocalipse de São João. Retorno ao hotel para aproveitar as águas termais.",
        spiritual:
          '"Ao anjo da igreja em Laodiceia escreve..." (Ap 3,14) — Pisamos em solo mencionado nas Escrituras, onde a Palavra de Deus ecoou através dos séculos.',
      },
    ],
  },
  {
    image: efesoImg,
    imageAlt: "Ruínas da antiga cidade de Éfeso",
    region: "Éfeso & Casa da Virgem Maria",
    days: [
      {
        day: "9° Dia",
        title: "ÉFESO / CASA DA VIRGEM MARIA / KUSADASI",
        description:
          "Visita ao maior sítio arqueológico do mundo em Éfeso, cidade importante na Bíblia na época do apóstolo Paulo. Visitaremos as ruínas da Basílica de São João, o túmulo de São João, e a Casa da Virgem Maria — local onde ela residia quando se mudou de Jerusalém com São João. Almoço. Continuação para Kusadasi.",
        spiritual:
          '"Eis aí a tua mãe" (Jo 19,27) — São João trouxe a Virgem Maria para Éfeso, onde ela viveu seus últimos anos. Peregrinamos ao lar da Mãe de Deus.',
      },
    ],
  },
  {
    image: bursaImg,
    imageAlt: "Mesquita Verde em Bursa",
    region: "Bursa → Istambul → Manaus",
    days: [
      {
        day: "10° Dia",
        title: "KUSADASI / BURSA / ISTAMBUL",
        description:
          "Saída com destino a Istambul. Parada em Bursa para visitar o mercado da seda, a Mesquita Verde e o Mausoléu Verde, construídos a pedido do Sultão Mehmet I, com interior decorado por azulejos Iznik de cores verde e turquesa. Chegada a Istambul.",
        spiritual:
          "Em Bursa, a beleza artística dos azulejos nos lembra que toda arte verdadeira é uma forma de oração e louvor ao Criador.",
      },
      {
        day: "11° Dia",
        title: "ISTAMBUL / MANAUS",
        description:
          "Após café da manhã, traslado ao aeroporto internacional de Istambul para embarque em voo com destino a Manaus, fazendo as devidas conexões. Chegada ao aeroporto internacional de Manaus. Fim dos nossos serviços.",
        spiritual:
          "Voltamos para casa renovados na fé, levando no coração as memórias desta peregrinação às terras onde a Palavra se fez história.",
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
          11 dias de peregrinação pelas terras bíblicas da Turquia, visitando igrejas do Apocalipse, a Casa da Virgem Maria e locais sagrados da fé cristã.
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
                          {day.spiritual && (
                            <p className="font-accent text-xs italic text-secondary/80 border-l-2 border-secondary/30 pl-3">
                              ✝ {day.spiritual}
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
            href="https://api.whatsapp.com/send/?phone=5519994718930&text=Ol%C3%A1%21+Encontrei+voc%C3%AAs+pelo+Google+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.+Aguardo+retorno&type=phone_number&app_absent=0"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-secondary hover:bg-secondary/90 text-secondary-foreground font-heading font-bold text-lg px-12 py-4 rounded-full transition-all hover:scale-105 shadow-lg"
          >
            Garanta Sua Vaga na Peregrinação
          </a>
        </div>
      </div>
    </section>
  );
};

export default Roteiro;
