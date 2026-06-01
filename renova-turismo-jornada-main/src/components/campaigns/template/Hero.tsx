import heroImage from "@/assets/africa-do-sul/hero.webp";

const Hero = () => {
  return (
    <section id="inicio" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* EDITAR: Substituir por imagem do destino */}
      <img src={heroImage} alt="[Destino]" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 container mx-auto px-4 pt-[6.75rem] pb-16 text-center">
        <p className="font-accent text-lg md:text-xl italic text-primary-foreground/80 mb-4 animate-fade-in-up">
          {/* EDITAR: Subtítulo */}
          Renova Turismo apresenta
        </p>
        <h1 className="font-heading text-3xl md:text-5xl lg:text-6xl font-extrabold text-primary-foreground leading-tight mb-6 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          {/* EDITAR: Título principal */}
          Viagem à África do Sul
        </h1>
        <p className="font-body text-lg md:text-xl text-primary-foreground/90 max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          {/* EDITAR: Descrição do hero */}
          Descubra as grandezas naturais da África do Sul com a Renova Turismo — uma experiência inesquecível.
        </p>

        {/* EDITAR: Substitua o ID do vídeo do YouTube */}
        <div className="max-w-xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.45s" }}>
          <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary-foreground/20 shadow-lg">
            <iframe
              src="https://www.youtube.com/embed/68j_DibdM6c?rel=0"
              title="Vídeo da Viagem para a África do Sul"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>

        <a
          href="https://api.whatsapp.com/send/?phone=5519992016125&text=Ol%C3%A1+Guilherme%21+Tenho+interesse+na+viagem+para+a+%C3%81frica+do+Sul+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.&type=phone_number&app_absent=0"
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
