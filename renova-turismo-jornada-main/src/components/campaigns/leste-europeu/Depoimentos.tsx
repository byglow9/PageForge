import { Star } from "lucide-react";
import GoogleReviewsCard from "@/components/shared/GoogleReviewsCard";

const testimonials = [
  {
    name: "Marcia Storani Silva",
    location: "",
    quote:
      "Nossa viagem ao leste europeu foi maravilhosa, os roteiros, hotéis, guias, a assistência dada pela Renova na pessoa do Rafael tbm foi espetacular.\nVisitamos lugares surpreendentes, muita história, cultura , costumes, hábitos alimentares e curiosidades fizeram parte dessa viagem. As guias super profissionais, com muita desenvoltura nos levaram para ver muita coisa interessante. Passeio noturno pelo Rio Danúbio, paisagens mágicas, o concerto em Viena muito lindo!!\nOs hotéis tbm muito bons, café da manhã excelente e os jantares temáticos tbm muito animados e gostosos. Sempre com alguma surpresa a Renova nos deixava satisfeitos e felizes, nos divertimos muito. Só uma ressalva: o jantar da despedida pode ser com um cardápio mais leve , menos comida e consequentemente menos desperdício.\nNada a reclamar, só agradecer por esse passeio que jamais esqueceremos.",
  },
  {
    name: "Rafaela Tordin",
    location: "",
    quote:
      "Fiz uma viagem inesquecível para o Leste Europeu com a Renova. O roteiro foi muito bem pensado e organizado, os guias eram preparados e atenciosos, e a assistência em todo o processo foi excelente. Não precisei me preocupar com nada, pois a equipe cuidou de tudo com muito profissionalismo. Agradeço pela experiência maravilhosa que me proporcionaram.",
  },
  {
    name: "Luciano Martins",
    location: "",
    quote:
      "Uma Empresa Responsável, Dedicada a proporcionar o máximo de bem estar aos Clientes. Eu sou Cliente da Renova Turismo, e estou muito Satisfeito com o empenho e organização, que é uma Marca Registrada desta Empresa.",
  },
];

const Stars = () => (
  <div className="flex gap-0.5 mb-3">
    {[...Array(5)].map((_, i) => (
      <Star key={i} className="text-yellow-500 fill-yellow-500" size={16} />
    ))}
  </div>
);

const Depoimentos = () => {
  return (
    <section id="depoimentos" className="py-12 md:py-28 pb-12 md:pb-16 bg-muted">
      <div className="container mx-auto px-4">
        <p className="font-accent text-lg italic text-secondary text-center mb-2">
          O que dizem nossos viajantes
        </p>
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary text-center mb-14">
          Depoimentos
        </h2>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((t) => (
            <div key={t.name} className="bg-card rounded-lg p-8 shadow-sm hover:shadow-md transition-shadow">
              <p className="font-heading font-semibold text-primary">{t.name}</p>
              <p className="font-body text-muted-foreground text-sm mb-3">{t.location}</p>
              <Stars />
              <p className="font-body text-muted-foreground text-sm leading-relaxed">{t.quote}</p>
            </div>
          ))}
        </div>

        <GoogleReviewsCard />
      </div>
    </section>
  );
};

export default Depoimentos;
