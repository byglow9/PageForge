import { useEffect, useState } from "react";
import heroImage1 from "@/assets/jmj-seul/namsan-autumn.jpg.asset.json";
import heroImage2 from "@/assets/jmj-seul/nami-autumn.jpg.asset.json";
import heroImage3 from "@/assets/jmj-seul/gyeongbokgung-blossom.jpg.asset.json";
import heroImage4 from "@/assets/jmj-seul/papa-bandeira-coreia.webp.asset.json";

const WHATSAPP_URL =
  "https://api.whatsapp.com/send/?phone=5519998974721&text=Ol%C3%A1+Fabiola%21+Tenho+interesse+na+viagem+para+a+JMJ+Seul+2027+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.&type=phone_number&app_absent=0";

const SLIDES = [
  { url: heroImage1.url, alt: "Torre Namsan em Seul durante o outono — sede da JMJ 2027" },
  { url: heroImage2.url, alt: "Ilha de Nami no outono, Coreia do Sul" },
  { url: heroImage3.url, alt: "Palácio Gyeongbokgung em Seul com cerejeiras em flor" },
  { url: heroImage4.url, alt: "Peregrinos com bandeiras na Jornada Mundial da Juventude" },
];


const Hero = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="inicio" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 flex h-full w-full transition-transform duration-[1200ms] ease-in-out" style={{ width: `${SLIDES.length * 100}%`, transform: `translateX(-${current * (100 / SLIDES.length)}%)` }}>
        {SLIDES.map((slide) => (
          <img
            key={slide.url}
            src={slide.url}
            alt={slide.alt}
            width={1920}
            height={1080}
            className={`h-full w-full object-cover flex-shrink-0`}
            style={{ width: `${100 / SLIDES.length}%` }}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-black/55" />

      <div className="relative z-10 container mx-auto px-4 pt-[6.75rem] pb-16 text-center">
        <p className="font-accent text-lg md:text-xl italic text-primary-foreground/80 mb-4 animate-fade-in-up">
          Renova Turismo apresenta
        </p>
        <h1 className="font-heading text-3xl md:text-5xl lg:text-6xl font-extrabold text-primary-foreground leading-tight mb-6 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          JMJ Seul 2027
        </h1>
        <p className="font-body text-lg md:text-xl text-primary-foreground/90 max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          Viva a Jornada Mundial da Juventude na Coreia do Sul com a Renova Turismo —
          fé, encontro com o Papa e uma experiência transformadora ao lado de jovens do mundo todo.
        </p>

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-secondary hover:bg-secondary/90 text-secondary-foreground font-heading font-bold text-lg px-10 py-4 rounded-full transition-all hover:scale-105 shadow-lg animate-fade-in-up"
          style={{ animationDelay: "0.6s" }}
        >
          Quero Participar
        </a>
      </div>
    </section>
  );
};

export default Hero;
