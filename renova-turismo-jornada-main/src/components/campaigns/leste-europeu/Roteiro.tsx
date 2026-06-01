import { useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import embarqueImg from "@/assets/leste-europeu/embarque.jpg";
import budapesteImg from "@/assets/leste-europeu/budapeste.webp";
import budapesteBastiaoImg from "@/assets/leste-europeu/budapeste-bastiao.webp";
import bratislavaImg from "@/assets/leste-europeu/bratislava.webp";
import vienaCentroImg from "@/assets/leste-europeu/viena-centro.webp";
import vienaImg from "@/assets/leste-europeu/viena.webp";
import pragaImg from "@/assets/leste-europeu/praga.jpg";
import pragaVelhaImg from "@/assets/leste-europeu/praga-velha.jpg";
import pragaCasteloImg from "@/assets/leste-europeu/praga-castelo.webp";
import pragaPonteImg from "@/assets/leste-europeu/praga-ponte.webp";
import pragaCarlosImg from "@/assets/leste-europeu/praga-carlos.webp";

interface DayCard {
  day: string;
  date: string;
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
    image: embarqueImg,
    imageAlt: "Voo intercontinental ao pôr do sol rumo ao Leste Europeu",
    region: "São Paulo → Budapeste",
    days: [
      {
        day: "1° Dia",
        date: "",
        title: "SÃO PAULO / BUDAPESTE",
        description:
          "Encontro no aeroporto internacional de Guarulhos para embarque em voo com destino a Budapeste, fazendo as devidas conexões. Noite e jantar a bordo.",
        highlight: "O início da grande jornada europeia.",
      },
    ],
  },
  {
    image: budapesteImg,
    imageAlt: "Vista panorâmica de Budapeste com o Parlamento e o Danúbio",
    region: "Budapeste",
    days: [
      {
        day: "2° Dia",
        date: "",
        title: "BUDAPESTE",
        description:
          'Chegada a Budapeste e traslado para o hotel. À tarde, tour panorâmico pela cidade. A cidade fica às margens do Danúbio e está dividida em duas partes: "Buda", onde se encontra o lado antigo da cidade, as residências da alta sociedade e as embaixadas, e "Pest", onde se encontra o centro comercial com todos os hotéis e restaurantes. Visitaremos a Igreja de Matias e também o monumento do Bastião dos Pescadores. Jantar e hospedagem.',
        highlight: "Buda e Pest às margens do Danúbio.",
      },
    ],
  },
  {
    image: budapesteBastiaoImg,
    imageAlt: "Bastião dos Pescadores e Igreja de Matias em Budapeste",
    region: "Budapeste",
    days: [
      {
        day: "3° Dia",
        date: "",
        title: "BUDAPESTE",
        description:
          "Após café da manhã, caminhada pela rua de pedestres ao edifício do Grande Mercado, que oferece a maior e mais rica seleção tanto de verduras e frutas frescas como de artesanato típico e produtos famosos da Hungria, como as pimentas, o vinho Tokaji, aguardentes e especiarias. Visitaremos a Catedral de Santo Estevão, a Opera, o Parlamento e a Cidadela. Retorno ao hotel para jantar e hospedagem.",
        highlight: "Sabores e tradições húngaras no Grande Mercado.",
      },
    ],
  },
  {
    image: bratislavaImg,
    imageAlt: "Castelo de Bratislava ao pôr do sol sobre o Danúbio",
    region: "Budapeste → Bratislava → Viena",
    days: [
      {
        day: "4° Dia",
        date: "",
        title: "BUDAPESTE / BRATISLAVA / VIENA",
        description:
          "Após café da manhã, saída para a bela e romântica Viena passando por Bratislava, capital da Eslováquia, onde conheceremos o imponente Castelo (visita externa) com sua linda vista para o Danúbio, o Palácio Presidencial e o centro histórico com seus típicos restaurantes e cafés. Finalizada a visita, continuaremos em direção a Viena. Jantar de boas-vindas no exclusivo restaurante Marchfelderhof com bebidas incluídas.",
        highlight: "Jantar de boas-vindas no Marchfelderhof, com bebidas inclusas.",
      },
    ],
  },
  {
    image: vienaCentroImg,
    imageAlt: "Ringstrasse e Hofburg em Viena com arquitetura imperial",
    region: "Viena — City Tour",
    days: [
      {
        day: "5° Dia",
        date: "",
        title: "VIENA",
        description:
          "Após o café da manhã, passeio panorâmico pela cidade percorrendo a 'Ringstrasse', os Museus de Belas Artes e Ciências Naturais, o monumento a Maria Teresa, o Parlamento, a Prefeitura, o Teatro Nacional e o Palácio Imperial 'Hofburg' (ingresso incluso). Visita igualmente aos Jardins do Belvedere, palácio de veraneio do Príncipe Eugênio de Saboia, com uma magnífica vista da cidade. Em seguida, passeio pelo centro antigo de Viena passando pelo Relógio Anker, Bairro Judeu, Praça Freyung, com seus palácios, e a Praça dos Heróis. O passeio termina com a visita ao interior da Catedral de Santo Estêvão. Retorno ao hotel. Jantar e hospedagem.",
        highlight: "Ingresso ao Palácio Imperial Hofburg incluso.",
      },
    ],
  },
  {
    image: vienaImg,
    imageAlt: "Palácio de Schönbrunn em Viena ao entardecer",
    region: "Viena → Praga",
    days: [
      {
        day: "6° Dia",
        date: "",
        title: "VIENA",
        description:
          "Após o café da manhã, visitaremos o Palácio de Schönbrunn e seus jardins (ingressos inclusos), considerado Patrimônio da Humanidade pela Unesco e, sem dúvida, um dos maiores tesouros da cidade. Em seguida, faremos uma excursão de barco ao famoso Vale do Danúbio e teremos tempo livre para caminhar pela movimentada rua de pedestres Kärntner Strasse. À noite, iremos participar de um maravilhoso concerto. Viena é também conhecida internacionalmente como a cidade da música e de compositores como Strauss, Mozart, Beethoven e Haydn, que nela deixaram a sua marca. Hospedagem e jantar.",
        highlight: "Schönbrunn, Vale do Danúbio e concerto vienense à noite.",
      },
      {
        day: "7° Dia",
        date: "",
        title: "VIENA / PRAGA",
        description:
          "Após o café da manhã, saída de ônibus para Praga. À noite, inesquecível passeio percorrendo o caminho que, nos tempos medievais, os reis faziam após a coroação na Catedral de São Vito. Oportunidade para apreciar as mais belas vistas da cidade iluminada e conhecer os 4 núcleos mais antigos de Praga. Hospedagem e jantar.",
        highlight: "Praga iluminada pelos passos dos antigos reis.",
      },
    ],
  },
  {
    image: pragaCasteloImg,
    imageAlt: "Castelo de Praga e Catedral de São Vito iluminados ao entardecer",
    region: "Praga — City Tour",
    days: [
      {
        day: "8° Dia",
        date: "",
        title: "PRAGA",
        description:
          "Após café da manhã, dia completo de city tour em Praga. Durante este passeio, você vai adquirir uma imagem geral sobre a cidade de Praga, considerada uma das mais belas capitais da Europa. Vai apreciar o tesouro histórico e arquitetônico da cidade de cem torres. Conhecerá o Castelo de Praga (ingresso incluso), considerado o maior castelo do mundo, com a magnífica Catedral de São Vito, Cidade Pequena, com seus palácios barrocos e a famosa Igreja da Nossa Senhora da Vitória com o milagroso Menino Jesus de Praga. A caminhada irá continuar ao longo da Ponte Carlos, a Cidade Velha, onde, na sua Praça Velha, fica o badalado relógio astronômico. Hospedagem e jantar.",
        highlight: "Castelo de Praga incluso — o maior do mundo.",
      },
    ],
  },
  {
    image: pragaPonteImg,
    imageAlt: "Vista panorâmica de Praga com a Ponte Carlos e o Castelo ao entardecer",
    region: "Praga",
    days: [
      {
        day: "9° Dia",
        date: "",
        title: "PRAGA",
        description:
          "Após café da manhã, conheceremos o Bairro Judeu de Praga, onde tem a mais antiga sinagoga da Europa, que foi construída em torno de 1270. A seguir visitaremos a Igreja de Nossa Senhora do Loreto, um dos santuários mais visitados de toda a Boemia, que abriga em seu interior a Câmara do Tesouro, cuja maior jóia é o Sol de Praga, uma obra de ourivesaria de valor incalculável. Prosseguiremos para a Igreja de São Nicolau, considerado um dos templos barrocos mais belos de toda Europa. Regresso ao hotel para jantar e hospedagem.",
        highlight: "Bairro Judeu, Loreto e o esplendor barroco de São Nicolau.",
      },
    ],
  },
  {
    image: pragaCarlosImg,
    imageAlt: "Ponte Carlos sobre o rio Vltava com a Cidade Velha de Praga ao fundo",
    region: "Praga",
    days: [
      {
        day: "10° Dia",
        date: "",
        title: "PRAGA",
        description:
          "Após café da manhã, faremos um passeio pelo misterioso bairro do Castelo (cujos arcos abrigam charmosos restaurantes), teremos tempo livre no bairro central de Mala Strana, com a possibilidade de comprar os finíssimos cristais tchecos ou assistir o pôr-do-sol caminhando pela Ponte CARLOS (famosa pelas dezenas de estátuas que ladeiam). Jantar e pernoite no hotel.",
        highlight: "Pôr do sol sobre a lendária Ponte Carlos.",
      },
    ],
  },
  {
    image: embarqueImg,
    imageAlt: "Asa de avião sobre nuvens ao pôr do sol no voo de retorno",
    region: "Praga → São Paulo",
    days: [
      {
        day: "11° Dia",
        date: "",
        title: "PRAGA / SÃO PAULO",
        description:
          "Café da manhã. Em horário combinado, traslado ao aeroporto de Praga para embarque em voo com destino a São Paulo, fazendo as devidas conexões.",
        highlight: "Voo de retorno após uma jornada inesquecível.",
      },
    ],
  },
  {
    image: embarqueImg,
    imageAlt: "Vista do céu pela janela do avião na chegada ao Brasil",
    region: "São Paulo",
    days: [
      {
        day: "12° Dia",
        date: "",
        title: "SÃO PAULO",
        description: "Chegada em São Paulo. Fim de nossos serviços.",
        highlight: "Memórias inesquecíveis para a vida toda.",
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
          Roteiro — Leste Europeu
        </h2>
        <p className="font-body text-muted-foreground text-center max-w-2xl mx-auto mb-12 text-sm">
          12 dias inesquecíveis pelo Leste Europeu: Budapeste, Bratislava, Viena e Praga — capitais imperiais, castelos medievais e o melhor da cultura europeia.
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
                        style={slide.imagePosition ? { objectPosition: slide.imagePosition } : undefined}
                        loading="lazy"
                        width={960}
                        height={640}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/30 to-transparent" />
                      <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
                        <div>
                          <span className="text-xs uppercase tracking-widest text-secondary font-body font-semibold block">
                            {slide.days.length > 1
                              ? `${slide.days[0].day} + ${slide.days[1].day}`
                              : slide.days[0].day}
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

                    <div className="px-5 md:px-8 pt-3 md:pt-4 pb-5 md:pb-8">
                      <div
                        className={`grid gap-4 ${
                          slide.days.length > 1
                            ? "grid-cols-1 md:grid-cols-2"
                            : "grid-cols-1"
                        }`}
                      >
                        {slide.days.map((day, dIdx) => (
                          <div
                            key={dIdx}
                            className="border border-border rounded-lg p-5 bg-background hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-center gap-3 mb-3 flex-wrap">
                              <span className="bg-secondary text-secondary-foreground text-xs font-heading font-bold px-3 py-1 rounded-full">
                                {day.day}
                              </span>
                              <h4 className="font-heading text-sm md:text-base font-bold text-primary">
                                {day.title}
                              </h4>
                            </div>
                            <p className="font-body text-muted-foreground text-sm leading-relaxed mb-3">
                              {day.description}
                            </p>
                            {day.highlight && (
                              <p className="font-accent text-xs italic text-secondary/90 border-l-2 border-secondary/40 pl-3">
                                ✦ {day.highlight}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            <CarouselPrevious className="hidden md:flex -left-4 md:-left-12 bg-primary text-primary-foreground border-none hover:bg-primary/90" />
            <CarouselNext className="hidden md:flex -right-4 md:-right-12 bg-primary text-primary-foreground border-none hover:bg-primary/90" />
          </Carousel>

          <div className="justify-center mt-3 flex-wrap mb-2 flex flex-row gap-[8px]">
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

        <div className="text-center mt-4">
          <a
            href="https://api.whatsapp.com/send/?phone=5519989542633&text=Ol%C3%A1%2C+Rafael%21+Tenho+interesse+na+viagem+para+o+Leste+Europeu+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.&type=phone_number&app_absent=0"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-secondary hover:bg-secondary/90 text-secondary-foreground font-heading font-bold text-lg px-12 py-4 rounded-full transition-all hover:scale-105 shadow-lg"
          >
            Garanta Sua Vaga
          </a>
        </div>
      </div>
    </section>
  );
};

export default Roteiro;
