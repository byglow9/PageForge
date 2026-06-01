import { useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";

import aeroportoManaus from "@/assets/mexico-padre-leudo/aeroporto-manaus.webp";
import guadalupeImg from "@/assets/mexico-padre-leudo/san-jacinto.webp";
import teotihuacanImg from "@/assets/mexico-padre-leudo/teotihuacan.jpg";
import pueblaImg from "@/assets/mexico-padre-leudo/basilica-guadalupe-aerea.webp";
import cancunImg from "@/assets/mexico-padre-leudo/cancun-aerea.webp";
import chichenItzaImg from "@/assets/mexico-padre-leudo/cancun-zona-hoteleira.webp";

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
    image: aeroportoManaus,
    imageAlt: "Aeroporto de Manaus — partida da peregrinação",
    region: "Manaus → Bogotá → Cidade do México",
    days: [
      {
        day: "1° Dia",
        title: "MANAUS / BOGOTÁ / CIDADE DO MÉXICO",
        description:
          "Encontro no Aeroporto de Manaus para embarque em voo com destino à Cidade do México. Chegada em Bogotá, recepção e city tour panorâmico pela cidade. Embarque para a Cidade do México. Chegada e traslado para o hotel. Hospedagem e jantar.",
        spiritual:
          "O início de uma jornada de fé — partimos em peregrinação rumo à terra de Nossa Senhora de Guadalupe.",
      },
    ],
  },
  {
    image: guadalupeImg,
    imageAlt: "Igreja colonial de San Jacinto, no bairro de San Ángel — Cidade do México",
    region: "Cidade do México & Teotihuacán",
    days: [
      {
        day: "2° Dia",
        title: "CIDADE DO MÉXICO / GUADALUPE",
        description:
          "Café da manhã. Saída para o sul da cidade, bairro colonial Parish Chimalistac. Continuação ao Bairro de San Angel, entre ruas de paralelepípedos, até a Igreja de San Jacinto. Seguimos a Coyoacán, onde admiraremos o templo de San Juan Batista. À tarde, visita à Basílica de Guadalupe, o mais importante centro mariano na América Latina, com Celebração da Santa Missa. Retorno ao hotel para jantar e hospedagem.",
        spiritual:
          '"Não estou eu aqui, que sou tua Mãe?" — palavras de Nossa Senhora a São Juan Diego, ecoam neste santuário onde milhões peregrinam.',
      },
      {
        day: "3° Dia",
        title: "TEOTIHUACÁN / XOCHIMILCO",
        description:
          "Café da manhã. Visita ao Museu de Antropologia e em seguida a um dos maiores sítios arqueológicos da Mesoamérica: Teotihuacán, a 'Cidade dos Deuses'. Visita ao templo de Quetzalcoatl, Calzada de los Muertos, Pirâmide do Sol e da Lua e templo Quetzal-Papalotl. Encerramos o dia com um passeio em uma trajinera tradicional em Xochimilco e tour no antigo convento de San Bernardino. Celebração da Santa Missa. Retorno ao hotel para jantar.",
        spiritual:
          "Diante das antigas pirâmides, contemplamos a busca humana pelo sagrado — busca plenamente respondida em Cristo.",
      },
    ],
  },
  {
    image: pueblaImg,
    imageAlt: "Vista aérea da Basílica de Nossa Senhora de Guadalupe — Cidade do México",
    region: "Centro Histórico & Tlaxcala / Puebla",
    days: [
      {
        day: "4° Dia",
        title: "CIDADE DO MÉXICO / GUADALUPE",
        description:
          "Café da manhã. Visita à Catedral Metropolitana, edifício de grande valor arquitetônico e cultural. Continuação à emblemática Plaza de Santo Domingo, onde conheceremos a Igreja de Santo Domingo. Seguimos à Plaza das 3 Culturas, que reúne os restos arqueológicos pré-conquista, o templo de Santiago da era espanhola e o México moderno. Retorno à Basílica de Guadalupe com Celebração da Santa Missa e tempo para atividades pessoais. Hospedagem e jantar.",
        spiritual:
          "Voltamos aos pés da Morenita do Tepeyac — a tilma de São Juan Diego permanece intacta há quase 500 anos como sinal do amor materno de Maria.",
      },
      {
        day: "5° Dia",
        title: "TLAXCALA / PUEBLA / PARIAN",
        description:
          "Café da manhã. Saída em direção a Tlaxcala para visitar a Basílica de Ocotlán, joia arquitetônica de estilo barroco. Continuação para o centro de Puebla, onde visitaremos a Catedral Metropolitana e a Capela do Rosário, com Celebração da Santa Missa. Tempo para almoço e visita à Feira de Parian. Retorno à Cidade do México para hospedagem e jantar.",
        spiritual:
          "A Capela do Rosário de Puebla, considerada a 'Oitava Maravilha do Mundo', é um cântico de louvor em ouro e azulejos a Nossa Senhora.",
      },
    ],
  },
  {
    image: cancunImg,
    imageAlt: "Vista aérea da costa de Cancún ao entardecer — Caribe Mexicano",
    region: "Cancún — Caribe Mexicano",
    days: [
      {
        day: "6° Dia",
        title: "CIDADE DO MÉXICO / CANCÚN",
        description:
          "Café da manhã e tempo livre. Traslado ao aeroporto para embarque com destino a Cancún. Chegada, recepção e traslado para o hotel. Hospedagem com sistema All Inclusive.",
        spiritual:
          "Após dias intensos de peregrinação, um tempo de descanso — também um presente de Deus para renovar corpo e alma.",
      },
      {
        day: "7° Dia",
        title: "CANCÚN — ISLA MUJERES",
        description:
          "Café da manhã. Dia livre para atividades independentes em sistema All Inclusive. Celebração da Santa Missa. Sugerimos visita à Isla de las Mujeres, com suas águas cristalinas e cenários paradisíacos.",
        spiritual:
          "Diante da imensidão do mar do Caribe, contemplamos a grandeza do Criador refletida na beleza da criação.",
      },
    ],
  },
  {
    image: chichenItzaImg,
    imageAlt: "Vista aérea da zona hoteleira de Cancún — Caribe Mexicano",
    region: "Cancún → Bogotá → Manaus",
    days: [
      {
        day: "8° Dia",
        title: "CANCÚN — CHICHÉN ITZÁ",
        description:
          "Café da manhã. Dia livre para atividades independentes em sistema All Inclusive. Celebração da Santa Missa. Sugerimos visita à Pirâmide de Chichén Itzá, uma das Sete Maravilhas do Mundo Moderno.",
        spiritual:
          "As ruínas maias nos lembram que toda civilização passa — somente o Reino de Deus permanece para sempre.",
      },
      {
        day: "9° Dia",
        title: "CANCÚN / BOGOTÁ / MANAUS",
        description:
          "Café da manhã. Em horário combinado, traslado ao aeroporto de Cancún para embarque em voo com destino a Manaus, com conexão em Bogotá.",
        spiritual:
          "Iniciamos o caminho de volta com o coração transbordando de gratidão pelas graças recebidas.",
      },
    ],
  },
  {
    image: aeroportoManaus,
    imageAlt: "Aeroporto de Manaus — chegada da peregrinação",
    region: "Manaus",
    days: [
      {
        day: "10° Dia",
        title: "MANAUS",
        description:
          "Chegada ao aeroporto internacional de Manaus. Fim de nossos serviços!",
        spiritual:
          "Voltamos para casa renovados na fé, levando no coração a ternura da Mãe de Guadalupe e as memórias desta peregrinação inesquecível.",
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
          10 dias de peregrinação pelo México, do Santuário de Nossa Senhora de Guadalupe às maravilhas de Teotihuacán, Puebla e Cancún.
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
