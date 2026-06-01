import heroImage from "@/assets/padre-leudo/hero-turkiye.webp";

const Hero = () => {
  return (
    <section
      id="inicio"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      <img
        src={heroImage}
        alt="Vista panorâmica da Turquia"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/30" />

      <div className="relative z-10 container mx-auto px-4 pt-[6.75rem] pb-16 text-center">
        <p className="font-accent text-lg md:text-xl italic text-primary-foreground/80 mb-4 animate-fade-in-up">
          de Manaus para o Mundo
        </p>
        <h1 className="font-heading text-5xl md:text-7xl font-extrabold text-primary-foreground leading-tight mb-6 animate-fade-in-up lg:text-8xl" style={{ animationDelay: "0.15s" }}>
          Peregrinação para Turquia
        </h1>
        <p className="font-body text-lg md:text-xl text-primary-foreground/90 max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          Explore a riqueza cultural e histórica da Turquia com a Renova Turismo e o Pe Leudo Santos — uma experiência inesquecível.
        </p>

        <div className="max-w-xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.45s" }}>
          <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary-foreground/20 bg-primary/40 backdrop-blur-sm hover:border-secondary transition-colors shadow-lg">
            <iframe
              className="h-full w-full"
              src="https://www.youtube.com/embed/AER3yXbe8YY?rel=0"
              title="Vídeo da viagem para a Turquia"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>

        <a
          href="https://api.whatsapp.com/send/?phone=5519994718930&text=Ol%C3%A1%21+Encontrei+voc%C3%AAs+pelo+Google+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.+Aguardo+retorno&type=phone_number&app_absent=0"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-secondary hover:bg-secondary/90 text-secondary-foreground font-heading font-bold text-lg px-10 py-4 rounded-full transition-all hover:scale-105 shadow-lg animate-fade-in-up"
          style={{ animationDelay: "0.6s" }}
        >
          Saiba Mais
        </a>
      </div>
    </section>
  );
};

export default Hero;
