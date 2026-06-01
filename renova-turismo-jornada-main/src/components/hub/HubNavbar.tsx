import logoRenova from "@/assets/logo-renova.svg";

const HubNavbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-sm shadow-lg shadow-primary/20">
      <div className="max-w-7xl mx-auto flex items-center justify-between py-3 px-4 md:px-8">
        <a href="/">
          <img src={logoRenova} alt="Renova Turismo" className="h-10 md:h-12" />
        </a>
        <div className="flex items-center gap-6">
          <a
            href="#viagens"
            className="font-body text-xs font-medium text-primary-foreground/80 hover:text-primary-foreground transition-colors"
          >
            Viagens
          </a>
          <a
            href="https://api.whatsapp.com/send/?phone=5519994718930&text=Ol%C3%A1%21+Encontrei+voc%C3%AAs+pelo+Google+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.+Aguardo+retorno&type=phone_number&app_absent=0"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-secondary px-6 py-2.5 font-heading text-sm font-semibold text-secondary-foreground hover:bg-secondary/90 transition-colors"
          >
            Fale Conosco
          </a>
        </div>
      </div>
    </nav>
  );
};

export default HubNavbar;
