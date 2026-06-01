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
import casablancaImg from "@/assets/marrocos/casablanca.jpg";
import fezImg from "@/assets/marrocos/fez.jpg";
import atlasImg from "@/assets/marrocos/atlas-erfoud.jpg";
import merzougaImg from "@/assets/marrocos/merzouga.jpg";
import ouarzazateImg from "@/assets/marrocos/ouarzazate.jpg";
import marrakeshImg from "@/assets/marrocos/marrakesh.jpg";

const WHATSAPP_URL =
  "https://api.whatsapp.com/send/?phone=5519936186395&text=Ol%C3%A1+Renata%21+Tenho+interesse+na+viagem+para+o+Marrocos+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.&type=phone_number&app_absent=0";

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
    imageAlt: "Aeroporto de Guarulhos – partida para o Marrocos",
    region: "São Paulo → Casablanca",
    days: [
      {
        day: "1º Dia",
        title: "SÃO PAULO / CASABLANCA",
        description:
          "Encontro no aeroporto internacional de Guarulhos para embarque em voo com destino a Casablanca, fazendo as devidas conexões.",
        highlight: "O início de uma jornada inesquecível pelas terras do Marrocos.",
      },
      {
        day: "2º Dia",
        title: "CASABLANCA",
        description: "Chegada. Jantar e pernoite no hotel.",
        highlight: "Recepção e descanso na maior cidade do Marrocos.",
      },
    ],
  },
  {
    image: casablancaImg,
    imageAlt: "Litoral de Casablanca, Marrocos",
    region: "Casablanca → Meknes → Fez",
    days: [
      {
        day: "3º Dia",
        title: "CASABLANCA / MEKNES / FEZ",
        description:
          "Após o café da manhã, breve visita à Capital Econômica: o bairro Habous, o Palácio Real, a praça Mohamed V, a área residencial de Anfa e a Mesquita Hassan II. Partida para Meknes, capital de Ismailia, com as maiores muralhas do Marrocos. Almoço em restaurante local. Visite o famoso portão de Bab Mansour, os estábulos reais e o bairro judeu. Partida para a cidade sagrada de Moulay Driss (vista panorâmica) e visite as ruínas romanas de Volubilis. Continuação para Fez, a cidade cultural e espiritual mais antiga do Marrocos. Jantar e pernoite no hotel.",
        highlight:
          "De Casablanca às muralhas imperiais de Meknes e às ruínas romanas de Volubilis, rumo à milenar Fez.",
      },
    ],
  },
  {
    image: fezImg,
    imageAlt: "Medina antiga de Fez",
    region: "Fez",
    days: [
      {
        day: "4º Dia",
        title: "FEZ",
        description:
          "Café da manhã. Dia dedicado à visita de Fez. Visita ao Palácio Real, o bairro judeu, a Medina Medieval, Attarine Ou Bou Anania Medersas (antiga escola corânica datada do século XIV), a famosa fonte Nejjarine, o Mausoléu Moulay Idriss e a Mesquita Karaouine (visita externa). Continuação do passeio pela antiga Medina onde veremos diferentes artesãos ainda operando na antiga tradição oriental. Em horário combinado retorno para o hotel para jantar e hospedagem.",
        highlight:
          "Imersão completa na cidade espiritual mais antiga do Marrocos e seus artesãos tradicionais.",
      },
    ],
  },
  {
    image: atlasImg,
    imageAlt: "Montanhas do Atlas e Ifrane",
    region: "Fez → Ifrane → Midelt → Erfoud",
    days: [
      {
        day: "5º Dia",
        title: "FEZ / IFRANE / MIDELT / ERFOUD",
        description:
          "Café da manhã. Partida para Erfoud passando pelas aldeias berberes de Immouzer-Kandar e Ifrane, uma estação de esqui localizada no meio de uma vasta clareira no coração de um importante maciço florestal. Chegada a Midelt, cidade encravada aos pés da cadeia de montanhas do Atlas. Continuação da viagem até Errachidia, um dos mais importantes centros comerciais antigos do Marrocos. Chegada a Erfoud. Jantar e pernoite no hotel.",
        highlight:
          "Atravessando o coração do Atlas pelas aldeias berberes até as portas do Saara.",
      },
    ],
  },
  {
    image: merzougaImg,
    imageAlt: "Dunas de Merzouga, deserto do Saara",
    region: "Erfoud → Dunas de Merzouga",
    days: [
      {
        day: "6º Dia",
        title: "ERFOUD / DUNAS DE MERZOUGA",
        description:
          "Após café da manhã, em veículos 4x4, iniciaremos nossa jornada com motoristas através do deserto negro para reviver as aventuras do Paris-Dakar, passando por suas trilhas bem no coração do Saara. Visitaremos o povo Gnawa, originalmente trazido do Sudão, o lago de Merzouga e o souk de Rissani, cidade tradicional e berço da dinastia Alaouita. Finalmente chegaremos às dunas de Merzouga. Tempo para passeio de camelo e para admirar o espetacular pôr do sol sobre as dunas. À noite, jantar servido à luz de velas. Jantar e alojamento em acampamento de luxo, no deserto do Saara.",
        highlight:
          "Uma experiência única no coração do Saara, com pôr do sol nas dunas e noite no acampamento berbere.",
      },
    ],
  },
  {
    image: ouarzazateImg,
    imageAlt: "Kasbah de Ait Ben Haddou em Ouarzazate",
    region: "Todra → Ouarzazate → Ait Ben Haddou → Marrakesh",
    days: [
      {
        day: "7º Dia",
        title: "DUNAS DE MERZOUGA / GARGANTA DE TODRA / OUARZAZATE",
        description:
          "Após o café da manhã, partida em jipes 4x4 para Erfoud para pegar o ônibus e seguir até Tineghir via Rissani. Visita às ruínas de Ksar Abbar e, pela estrada de Tinjdad, chegada às Gargantas de Todra, conhecidas por suas impressionantes escarpas. Continuação para Ouarzazate pela pequena cidade de El Kelâa M'gouna, a Capital das Rosas, e o vale do Dades. Chegada a Ouarzazate, jantar e pernoite no hotel.",
        highlight:
          "Das dunas às escarpas dramáticas de Todra e ao vale das rosas do Dades.",
      },
      {
        day: "8º Dia",
        title: "OUARZAZATE / AIT BEN HADDOU / MARRAKESH",
        description:
          "Após o café da manhã, início da viagem para Marrakesh. No caminho visita à cidade de Ouarzazate – a Hollywood Marroquina, incluindo visita ao Atlas Studios. Continuação para Ait Ben Haddou, patrimônio mundial da UNESCO, conhecida como a fortaleza mais espetacular do sul do Marrocos e cenário de filmes como Lawrence da Arábia, Troia, Gladiador e Game of Thrones. Seguiremos viagem até Marrakesh, atravessando as magníficas montanhas do Alto Atlas. Chegada, jantar e pernoite no hotel.",
        highlight:
          "A icônica Kasbah de Ait Ben Haddou e a travessia do Alto Atlas até a pérola do sul.",
      },
    ],
  },
  {
    image: marrakeshImg,
    imageAlt: "Jardins e cores de Marrakesh",
    region: "Marrakesh",
    days: [
      {
        day: "9º Dia",
        title: "MARRAKESH",
        description:
          "Café da manhã. Visita de dia inteiro a Marrakesh, a segunda cidade imperial mais antiga, chamada de \"a pérola do sul\". A visita histórica inclui o Jardim Menara, o Palácio da Bahia, a Koutoubia e o Museu Dar Si Said. Pela tarde, visita aos souks, casas de artesanatos e a famosa Praça Jemaa El-Fna, com entretenimento ininterrupto. Jantar com show em Chez Ali. Pernoite no hotel.",
        highlight:
          "Um dia completo pela pérola do sul, com jantar e show tradicional em Chez Ali.",
      },
      {
        day: "10º Dia",
        title: "MARRAKESH",
        description:
          "Café da manhã. Visita aos Jardins Majorelle, também chamado Yves Saint Laurent. Tarde livre para compras ou passeios pessoais. Jantar e pernoite no hotel.",
        highlight:
          "Os famosos Jardins Majorelle e uma tarde livre para explorar Marrakesh no seu ritmo.",
      },
    ],
  },
  {
    image: guarulhosImg,
    imageAlt: "Aeroporto – retorno ao Brasil",
    region: "Marrakesh → São Paulo",
    days: [
      {
        day: "11º Dia",
        title: "MARRAKESH / SÃO PAULO",
        description:
          "Café da manhã. Em horário combinado, traslado para o aeroporto com destino a São Paulo, fazendo as devidas conexões.",
        highlight: "Despedida do Marrocos com a bagagem cheia de memórias inesquecíveis.",
      },
      {
        day: "12º Dia",
        title: "SÃO PAULO",
        description: "Chegada em São Paulo. Fim dos nossos serviços!",
        highlight: "Retorno ao Brasil após uma jornada única pelas terras marroquinas.",
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
          Roteiro — Marrocos
        </h2>
        <p className="font-body text-muted-foreground text-center max-w-2xl mx-auto mb-12 text-sm">
          12 dias percorrendo Casablanca, Meknes, Fez, Atlas, o deserto do Saara, Ouarzazate e Marrakesh.
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
            Conheça mais sobre o roteiro
          </a>
        </div>
      </div>
    </section>
  );
};

export default Roteiro;
