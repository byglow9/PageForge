import { useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import embarqueImg from "@/assets/africa-do-sul/embarque.jpg";
import johannesburgoImg from "@/assets/africa-do-sul/johannesburgo-skyline.webp";
import blydeCanyonImg from "@/assets/africa-do-sul/blyde-canyon.jpg";
import safariKrugerImg from "@/assets/africa-do-sul/safari-kruger.jpg";
import elefantesKrugerImg from "@/assets/africa-do-sul/elefantes-kruger.webp";
import leoesKrugerImg from "@/assets/africa-do-sul/leoes-kruger.webp";
import capeTownImg from "@/assets/africa-do-sul/cape-town.jpg";
import pretoriaImg from "@/assets/africa-do-sul/pretoria-union-buildings.webp";
import caboBoaEsperancaImg from "@/assets/africa-do-sul/cabo-boa-esperanca.jpg";
import winelandsImg from "@/assets/africa-do-sul/stellenbosch-vinhedos.webp";

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
  day: DayCard;
}

const slides: Slide[] = [
  {
    image: embarqueImg,
    imageAlt: "Voo intercontinental ao pôr do sol rumo à África do Sul",
    region: "São Paulo → Johannesburgo",
    day: {
      day: "1° Dia",
      date: "09 Set",
      title: "SÃO PAULO / JOHANNESBURGO",
      description:
        "Encontro no Aeroporto Internacional de Guarulhos para embarque com destino a Johannesburgo, realizando as devidas conexões. Noite a bordo.",
      highlight: "O início da grande jornada africana.",
    },
  },
  {
    image: johannesburgoImg,
    imageAlt: "Skyline de Johannesburgo com a Hillbrow Tower em destaque",
    region: "Johannesburgo",
    day: {
      day: "2° Dia",
      date: "10 Set",
      title: "JOHANNESBURGO",
      description:
        "Chegada ao Aeroporto Internacional de Johannesburgo, recepção pelo guia local especializado e traslado ao hotel, com visita panorâmica de Soweto e entrada na Mandela House no caminho do hotel. Jantar e hospedagem.",
      highlight: "Soweto e Mandela House: história viva da África do Sul.",
    },
  },
  {
    image: elefantesKrugerImg,
    imageAlt: "Família de elefantes na savana do Kruger Park com céu azul",
    region: "Johannesburgo → Reserva Privada / Kruger",
    day: {
      day: "3° Dia",
      date: "11 Set",
      title: "JOHANNESBURGO / RESERVA PRIVADA — KRUGER PARK",
      description:
        "Após o café da manhã, saída com destino à Reserva Privada na região do Kruger Park, atravessando a província de Mpumalanga. Durante o percurso, visita a locais de impressionante beleza natural, como o Cânion do Rio Blyde. Chegada à reserva, jantar e hospedagem.",
      highlight: "Cânion do Rio Blyde — um dos maiores cânions verdes do mundo.",
    },
  },
  {
    image: leoesKrugerImg,
    imageAlt: "Família de leões descansando na savana do Kruger Park",
    region: "Reserva Privada / Kruger Park",
    day: {
      day: "4° Dia",
      date: "12 Set",
      title: "RESERVA PRIVADA — KRUGER PARK",
      description:
        "Pela manhã, saída para um safári de dia completo em veículos 4x4, acompanhado por um ranger e um tracker, especialistas em rastrear e localizar os animais na savana. A aventura oferece a oportunidade de observar os famosos \"Big Five\" — elefante, búfalo, rinoceronte, leão e leopardo — além de inúmeras outras espécies. Retorno ao hotel para jantar e hospedagem.",
      highlight: "Safári completo em busca dos lendários Big Five.",
    },
  },
  {
    image: pretoriaImg,
    imageAlt: "Union Buildings em Pretória ao entardecer com luz dourada",
    region: "Kruger → Pretória → Cape Town",
    day: {
      day: "5° Dia",
      date: "13 Set",
      title: "RESERVA PRIVADA / CAPE TOWN",
      description:
        "Após o café da manhã, saída com destino ao aeroporto de Johannesburgo. Durante o trajeto, faremos uma visita panorâmica pela cidade de Pretória, capital administrativa da África do Sul, passando por seus principais pontos de interesse, como a Union Buildings, sede do governo, e os belos jardins que cercam o local. Em seguida, embarque em voo com destino a Cape Town, uma das cidades mais belas do país. Chegada, recepção e traslado ao hotel para acomodação. Jantar e hospedagem.",
      highlight: "Pretória administrativa e a chegada à deslumbrante Cape Town.",
    },
  },
  {
    image: capeTownImg,
    imageAlt: "Bairro Bo-Kaap colorido em Cape Town com Table Mountain",
    imagePosition: "center",
    region: "Cape Town — City Tour",
    day: {
      day: "6° Dia",
      date: "14 Set",
      title: "CAPE TOWN",
      description:
        "Após o café da manhã, início do city tour pela charmosa Cape Town, conhecida como a \"Cidade Mãe\". Visita à estação do teleférico da Table Mountain*, de onde se tem uma vista panorâmica da cidade e da baía. Continuação do passeio pelo pitoresco bairro Bo Kaap, Catedral de St. George, Company Gardens, Grand Parade, antiga Prefeitura e Castelo da Boa Esperança. Retorno ao hotel. Jantar e hospedagem.",
      highlight: "*Subida à Table Mountain sujeita às condições climáticas.",
    },
  },
  {
    image: caboBoaEsperancaImg,
    imageAlt: "Falésias do Cabo da Boa Esperança com farol e oceano azul",
    region: "Península do Cabo",
    day: {
      day: "7° Dia",
      date: "15 Set",
      title: "CAPE TOWN — PENÍNSULA DO CABO",
      description:
        "Após o café da manhã, saída para uma espetacular excursão à Península do Cabo, percorrendo um dos trajetos mais belos da África do Sul. O percurso segue pela costa, revelando paisagens deslumbrantes, rica flora e fauna marinha. Primeira parada em Hout Bay, onde faremos um minicruzeiro até a ilha habitada por uma colônia de focas do Cabo. Em seguida, seguiremos pela estrada Chapman's Peak Drive até a Reserva Natural do Cabo da Boa Esperança, onde poderemos subir de funicular ao antigo farol e admirar a vista da False Bay (almoço incluído). Visita a Simon's Town, sede da Marinha Sul-Africana, para conhecer a famosa colônia de pinguins africanos. No retorno, parada para uma caminhada pelos Jardins Botânicos de Kirstenbosch. Retorno ao hotel. Jantar e hospedagem.",
      highlight: "Almoço incluído. *Roteiro sujeito às condições climáticas.",
    },
  },
  {
    image: winelandsImg,
    imageAlt: "Vinhedos de Stellenbosch com montanhas ao fundo na luz dourada",
    imagePosition: "center",
    region: "Cape Town → Winelands → Cape Town",
    day: {
      day: "8° Dia",
      date: "16 Set",
      title: "CAPE TOWN / WINELANDS / CAPE TOWN",
      description:
        "Após o café da manhã, passeio pela encantadora Região das Vinícolas. Visita à cidade de Stellenbosch, a segunda mais antiga do Cabo e berço da uva Pinotage. Degustação de vinhos em vinícola local e tempo livre para passear por suas ruas arborizadas e admirar as casas em estilo Cape-Dutch. Continuação até o vale de Franschhoek (\"o canto francês\"), onde se instalaram os primeiros huguenotes franceses há mais de 300 anos. Segunda degustação em vinícola da região. Franschhoek encanta por suas montanhas majestosas, lojas de antiguidades, galerias de arte e confeitarias charmosas. Retorno ao hotel. Jantar e hospedagem.",
      highlight: "Almoço incluído + duas degustações de vinhos.",
    },
  },
  {
    image: embarqueImg,
    imageAlt: "Asa de avião sobre nuvens ao pôr do sol no voo de retorno",
    region: "Cape Town → Johannesburgo → São Paulo",
    day: {
      day: "9° Dia",
      date: "17 Set",
      title: "CAPE TOWN / JOHANNESBURGO / SÃO PAULO",
      description:
        "Após o café da manhã, em horário determinado, traslado ao aeroporto para embarque em voo de retorno a São Paulo, realizando as devidas conexões. Chegada no aeroporto de São Paulo-Guarulhos, trâmites de desembarque e fim dos nossos serviços.",
      highlight: "Memórias inesquecíveis para a vida toda.",
    },
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
          Roteiro — África do Sul
        </h2>
        <p className="font-body text-muted-foreground text-center max-w-2xl mx-auto mb-12 text-sm">
          9 dias inesquecíveis pela África do Sul: Johannesburgo, Soweto, Kruger Park, Pretória, Cape Town, Cabo da Boa Esperança e a Região das Vinícolas.
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
                            {slide.day.day}
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
                      <div className="border border-border rounded-lg p-5 bg-background hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <span className="bg-secondary text-secondary-foreground text-xs font-heading font-bold px-3 py-1 rounded-full">
                            {slide.day.day}
                          </span>
                          <h4 className="font-heading text-sm md:text-base font-bold text-primary">
                            {slide.day.title}
                          </h4>
                        </div>
                        <p className="font-body text-muted-foreground text-sm leading-relaxed mb-3">
                          {slide.day.description}
                        </p>
                        {slide.day.highlight && (
                          <p className="font-accent text-xs italic text-secondary/90 border-l-2 border-secondary/40 pl-3">
                            ✦ {slide.day.highlight}
                          </p>
                        )}
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
            href="https://api.whatsapp.com/send/?phone=5519994718930&text=Ol%C3%A1+Nayara%21+Tenho+interesse+na+viagem+para+a+%C3%81frica+do+Sul+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.&type=phone_number&app_absent=0"
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
