import cardAfricaDoSul from "@/assets/africa-do-sul/card-cover.webp";
import cardPortugal from "@/assets/portugal/card-cover.jpg";
import cardLideres from "@/assets/lideres/hero-bg.webp";

export interface Campaign {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  date: string;
  badge?: string;
  published?: boolean;
}

import heroTurkiye from "@/assets/padre-leudo/hero-turkiye.webp";
import cardMexico from "@/assets/mexico-padre-leudo/card-cover.webp";
import cardLesteEuropeu from "@/assets/leste-europeu/hero.webp";
import cardMarrocos from "@/assets/marrocos/hero.jpg";
import cardJmjSeul from "@/assets/jmj-seul/card-cover.jpg";
import cardGrecia from "@/assets/grecia/hero-santorini.jpg";

export const campaigns: Campaign[] = [
  {
    id: "mexico-padre-leudo",
    slug: "/mexico-padre-leudo",
    title: "México — Pe. Leudo Santos",
    subtitle: "de Manaus para o Mundo",
    description:
      "Peregrinação pelo México visitando o Santuário de Nossa Senhora de Guadalupe e os principais locais da fé católica mexicana.",
    image: cardMexico,
    date: "Datas sob consulta",
    badge: "Peregrinação",
    published: true,
  },
  {
    id: "turquia-padre-leudo",
    slug: "/turquia-padre-leudo",
    title: "Turquia — Pe. Leudo Santos",
    subtitle: "de Manaus para o Mundo",
    description:
      "11 dias de peregrinação pelas terras bíblicas da Turquia, visitando igrejas do Apocalipse, a Casa da Virgem Maria e locais sagrados da fé cristã.",
    image: heroTurkiye,
    date: "06 a 17 de Setembro de 2027",
    badge: "Peregrinação",
    published: true,
  },
  {
    id: "turquia",
    slug: "/turquia",
    title: "Turquia",
    subtitle: "Renova Turismo apresenta",
    description:
      "Uma jornada explorando alguns dos cenários mais marcantes da Turquia, com cidades históricas, paisagens icônicas e experiências culturais inesquecíveis.",
    image: heroTurkiye,
    date: "Outubro de 2026 e 2027",
    badge: "Experiência",
    published: true,
  },
  {
    id: "africa-do-sul",
    slug: "/africa-do-sul",
    title: "África do Sul",
    subtitle: "RENOVA TURISMO APRESENTA",
    description:
      "Explore a beleza selvagem e a cultura vibrante da África do Sul em uma jornada inesquecível.",
    image: cardAfricaDoSul,
    date: "Setembro de 2026, 2027 e 2028",
    badge: "Experiência",
    published: true,
  },
  {
    id: "africa-do-sul-2",
    slug: "/africa-do-sul-2",
    title: "África do Sul 2",
    subtitle: "RENOVA TURISMO APRESENTA",
    description:
      "Explore a beleza selvagem e a cultura vibrante da África do Sul em uma jornada inesquecível.",
    image: cardAfricaDoSul,
    date: "Setembro de 2026, 2027 e 2028",
    badge: "Experiência",
    published: true,
  },
  {
    id: "portugal",
    slug: "/portugal",
    title: "Portugal",
    subtitle: "RENOVA TURISMO APRESENTA",
    description:
      "Uma peregrinação a Portugal é um mergulho profundo na devoção mariana, onde o silêncio do Santuário de Fátima convida à conversão e à oração pela paz mundial.",
    image: cardPortugal,
    date: "Outubro de 2026",
    badge: "Peregrinação",
    published: true,
  },
  {
    id: "leste-europeu",
    slug: "/leste-europeu",
    title: "Leste Europeu",
    subtitle: "RENOVA TURISMO APRESENTA",
    description:
      "Uma jornada cultural pelas capitais imperiais e cidades históricas do Leste Europeu, com castelos, catedrais e paisagens encantadoras.",
    image: cardLesteEuropeu,
    date: "Agosto de 2026 e 2027",
    badge: "Experiência",
    published: true,
  },
  {
    id: "marrocos",
    slug: "/marrocos",
    title: "Marrocos",
    subtitle: "RENOVA TURISMO APRESENTA",
    description:
      "Uma imersão por cidades imperiais, medinas vibrantes, montanhas do Atlas e a magia do deserto do Saara.",
    image: cardMarrocos,
    date: "17 a 26 de Novembro de 2026",
    badge: "Experiência",
    published: true,
  },
  {
    id: "jmj-seul-2027",
    slug: "/jmj-seul-2027",
    title: "JMJ Seul 2027",
    subtitle: "JORNADA MUNDIAL DA JUVENTUDE",
    description:
      "Viva a Jornada Mundial da Juventude em Seul, na Coreia do Sul, ao lado do Papa e de milhões de jovens católicos do mundo todo.",
    image: cardJmjSeul,
    date: "31 de julho até 11 Agosto de 2027",
    badge: "JMJ",
    published: false,
  },
  {
    id: "grecia",
    slug: "/grecia",
    title: "Grécia",
    subtitle: "RENOVA TURISMO APRESENTA",
    description:
      "Uma jornada entre deuses, ilhas e o azul mais profundo do Mediterrâneo — do esplendor de Atenas à magia das Cíclades.",
    image: cardGrecia,
    date: "Datas sob consulta — 2026 / 2027",
    badge: "Experiência",
    published: false,
  },
  {
    id: "lideres",
    slug: "/lideres-catolicos",
    title: "Líderes Católicos",
    subtitle: "PADRES E LÍDERES",
    description:
      "Leve sua comunidade para uma jornada espiritual na Terra Santa com segurança, tradição e confiança. Pacote 100% completo para líderes católicos.",
    image: cardLideres,
    date: "Datas sob consulta",
    badge: "Líderes",
    published: true,
  },
  {
    id: "lideres-evangelicos",
    slug: "/lideres-evangelicos",
    title: "Líderes Evangélicos",
    subtitle: "PASTORES E LÍDERES",
    description:
      "Conduza sua igreja em uma peregrinação transformadora pela Terra Santa, com roteiro completo e suporte total para líderes evangélicos.",
    image: cardLideres,
    date: "Datas sob consulta",
    badge: "Líderes",
    published: true,
  },
];
