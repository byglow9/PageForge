import { Star } from "lucide-react";
import GoogleReviewsCard from "@/components/shared/GoogleReviewsCard";

const testimonials = [
  {
    name: "Gabrielle Souza",
    location: "",
    quote: `Amamos nossa viagem para a Turquia!
Fomos em outubro com a Renova Viagens e foi simplesmente incrível. O grupo era diverso, com pessoas de várias partes do Brasil. Era minha primeira viagem em grupo e amei a experiência — tudo foi muito tranquilo e fizemos amigos para a vida toda.

Os guias cuidaram de cada detalhe, então não precisávamos nos preocupar com nada: era só admirar as paisagens, aproveitar os hotéis, saborear a culinária local e não perder o horário! Tivemos o privilégio de ter o Mustafa como guia local, que explicou com muita riqueza de detalhes cada cantinho do país. Visitamos Istambul, Capadócia, Pamukkale e as 7 Igrejas do Apocalipse — uma experiência inesquecível.

O ônibus era superconfortável, com Wi-Fi, carregador e um motorista excelente, o Ibo, que dirigia com segurança o tempo todo. Os hotéis selecionados eram ótimos — chegávamos e o check-in já estava feito! Nos pontos turísticos, o guia explicava tudo e depois tínhamos um tempo livre para fotos e passeio.

Sobre a Renova, só elogios! Nota 10 em tudo: comunicação clara, forma de pagamento transparente, grupo criado com antecedência para repassar todas as informações e equipe sempre disponível para ajudar.`,
  },
  {
    name: "Erica Antunes",
    location: "",
    quote: `A viagem a Turquia e Grécia foi incrível, uma experiência inesquecível. Os passeios superaram minhas expectativas.
Só tenho a agradecer a Equipe Renova Turismo pelo excelente trabalho , pela organização impecável , tudo bem planejado , roteiro perfeito, ótimos hotéis, guias locais qualificados .
Não poderia deixar de falar do Tour Leader, Alexandre , foi extremamente profissional, educado , simpático, gentil , sempre atento com cada um do grupo ( e olha , demos trabalho , kkkk) .
Enfim , agradeço a todos pelo cuidado em cada detalhe . Até a próxima viagem .
Abraço fraterno`,
  },
  {
    name: "Maria Aparecida Tasseli Nunes",
    location: "",
    quote: `Minha primeira viagem para o exterior foi fantástica Turquia 🇹🇷 é sensacional só tenho de agradecer a Renova Turismo pelo roteiro maravilhoso, amei cada detalhe.
📍Quero também deixar aqui meus agradecimentos ao Elton que é nota 1000 estava sempre preocupado e atencioso com o grupo e principalmente quando perdi meu passaporte dentro do aeroporto em Londres, ele ficou comigo e fez tudo que pode para me ajudar na imigração, vi seu desespero hora que disseram que não podia mais ficar comigo, foi momentos de desespero, mas senti muita confiança nele e na equipe da Renova, minha gratidão eterna.
Por isso vá com quem te dá apoio nos momentos difíceis 😉`,
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
            <div
              key={t.name}
              className="bg-card rounded-lg p-8 shadow-sm hover:shadow-md transition-shadow"
            >
              <p className="font-heading font-semibold text-primary">{t.name}</p>
              <p className="font-body text-muted-foreground text-sm mb-3">{t.location}</p>
              <Stars />
              <p className="font-body text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                {t.quote}
              </p>
            </div>
          ))}
        </div>

        <GoogleReviewsCard />
      </div>
    </section>
  );
};

export default Depoimentos;