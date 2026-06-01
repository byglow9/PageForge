import istanbulImg from "@/assets/istanbul.webp";
import efesoImg from "@/assets/efeso.webp";
import pamukkaleImg from "@/assets/pamukkale.jpg";
import capadociaImg from "@/assets/capadocia.jpg";

const cities = [
  {
    nameEn: "Istanbul",
    namePt: "Istambul",
    image: istanbulImg,
    description:
      "Portal entre Oriente e Ocidente, Istambul guarda séculos de história fascinante. Da majestosa Hagia Sophia à icônica Mesquita Azul, cada esquina revela camadas de civilização e cultura.",
  },
  {
    nameEn: "Ephesus",
    namePt: "Éfeso",
    image: efesoImg,
    description:
      "Uma das cidades antigas mais bem preservadas do mundo, lar do lendário Templo de Ártemis e de ruínas monumentais. Caminhe por ruas milenares e sinta a grandeza do Império Romano.",
  },
  {
    nameEn: "Pamukkale",
    namePt: "Pamukkale",
    image: pamukkaleImg,
    description:
      "Maravilha natural de terraços brancos e águas termais turquesas, vizinha à antiga Hierápolis — cidade histórica com ruínas impressionantes e paisagens de tirar o fôlego.",
  },
  {
    nameEn: "Cappadocia",
    namePt: "Capadócia",
    image: capadociaImg,
    description:
      "Paisagem surreal de chaminés de fadas e habitações esculpidas na rocha. A Capadócia é um cenário único no mundo, famosa pelos voos de balão e cidades subterrâneas milenares.",
  },
];

const Roteiro = () => {
  return (
    <section id="roteiro" className="pt-12 md:pt-28 pb-8 md:pb-16 bg-background">
      <div className="container mx-auto px-4">
        <p className="font-accent text-lg italic text-secondary text-center mb-2">
          Saiba as principais
        </p>
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary text-center mb-14">
          Cidades que você irá conhecer
        </h2>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {cities.map((city) => (
            <div
              key={city.namePt}
              className="group bg-card rounded-xl overflow-hidden shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300"
            >
              <div className="relative overflow-hidden h-64">
                <img
                  src={city.image}
                  alt={city.namePt}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-5">
                  <span className="text-xs uppercase tracking-widest text-[#0b9ad6]" style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600 }}>
                    {city.nameEn}
                  </span>
                  <h3 className="font-heading text-2xl font-bold text-white">
                    {city.namePt}
                  </h3>
                </div>
              </div>
              <div className="p-6">
                <p className="font-body text-muted-foreground text-sm leading-relaxed">
                  {city.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-muted-foreground/60 text-sm italic mt-8">
          + de 3 opções de roteiro para você conhecer
        </p>

        <div className="text-center mt-10">
          <a
            href="https://api.whatsapp.com/send/?phone=5519994718930&text=Ol%C3%A1%21+Encontrei+voc%C3%AAs+pelo+Google+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.+Aguardo+retorno&type=phone_number&app_absent=0"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-secondary hover:bg-secondary/90 text-secondary-foreground font-heading font-bold text-lg px-12 py-4 rounded-full transition-all hover:scale-105 shadow-lg"
          >
            Entre em Contato
          </a>
        </div>
      </div>
    </section>
  );
};

export default Roteiro;
