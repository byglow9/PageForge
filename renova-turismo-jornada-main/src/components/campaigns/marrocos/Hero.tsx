import heroImage from "@/assets/marrocos/hero.jpg";
import { useYouTubeVolume } from "@/hooks/useYouTubeVolume";

const WHATSAPP_URL =
  "https://api.whatsapp.com/send/?phone=5519936186395&text=Ol%C3%A1+Renata%21+Tenho+interesse+na+viagem+para+o+Marrocos+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.&type=phone_number&app_absent=0";

const Hero = () => {
  const iframeRef = useYouTubeVolume(50);

  return (
    <section id="inicio" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <img src={heroImage} alt="Marrocos — paisagem cultural com cidades coloridas e montanhas do Atlas" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 container mx-auto px-4 pt-[6.75rem] pb-16 text-center">
        <p className="font-accent text-lg md:text-xl italic text-primary-foreground/80 mb-4 animate-fade-in-up">
          Renova Turismo apresenta
        </p>
        <h1 className="font-heading text-3xl md:text-5xl lg:text-6xl font-extrabold text-primary-foreground leading-tight mb-6 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          Viagem ao Marrocos
        </h1>
        <p className="font-body text-lg md:text-xl text-primary-foreground/90 max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          Uma jornada por cidades imperiais, desertos dourados e a magia das medinas — descubra o Marrocos com a Renova Turismo.
        </p>

        <div className="max-w-xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.45s" }}>
          <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary-foreground/20 shadow-lg">
            <iframe
              ref={iframeRef}
              src="https://www.youtube.com/embed/1pSKio3cLOM?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=1pSKio3cLOM&enablejsapi=1"
              title="Viagem ao Marrocos - Renova Turismo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>

        <a
          href={WHATSAPP_URL}
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
