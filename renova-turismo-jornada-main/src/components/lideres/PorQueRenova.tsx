import { Plane, Building2, Bus, Utensils, MessageCircle, ShieldCheck } from "lucide-react";

const WHATSAPP_URL =
  "https://wa.me/5519998947307?text=Ol%C3%A1!%20Vim%20do%20site%20e%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es.";

const items = [
  { icon: Plane, title: "Passagens Aéreas", text: "Nacionais e internacionais, com as melhores conexões." },
  { icon: Building2, title: "Hospedagem Confortável", text: "Hotéis selecionados e com alto padrão de qualidade." },
  { icon: Bus, title: "Translados", text: "Para deslocamentos durante o percurso." },
  { icon: Utensils, title: "Refeições Inclusas", text: "Café da manhã e jantar, para uma experiência mais completa." },
  { icon: MessageCircle, title: "Guias em Português", text: "Guias especializados em história e religião, falando a nossa língua." },
  { icon: ShieldCheck, title: "Segurança Total", text: "Seguro viagem completo e assistência 24h da equipe Renova." },
];

const PorQueRenova = () => {
  return (
    <section className="py-20 md:py-28 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4">
        <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-6 tracking-tight">
          Por que escolher a <span className="text-secondary">Renova</span>?
        </h2>
        <p className="font-body text-base md:text-lg text-primary-foreground/90 text-center max-w-3xl mx-auto mb-14 leading-relaxed">
          Sabemos da complexidade e da responsabilidade de guiar uma comunidade em uma jornada internacional. Por isso, nosso pacote 100% completo inclui:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto mb-14">
          {items.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="group relative flex items-start gap-4 p-6 rounded-2xl overflow-hidden backdrop-blur-xl bg-gradient-to-br from-primary-foreground/8 via-primary-foreground/3 to-primary-foreground/5 border border-primary-foreground/[0.07] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_8px_32px_-8px_rgba(0,0,0,0.35)] hover:-translate-y-1 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_20px_40px_-12px_rgba(0,0,0,0.45)] hover:border-primary-foreground/[0.14] transition-all duration-500"
            >
              {/* Liquid glass highlights */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-primary-foreground/6 via-transparent to-transparent opacity-60" />
              <div className="pointer-events-none absolute -top-20 -left-10 w-40 h-40 rounded-full bg-primary-foreground/8 blur-2xl opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
              <div className="pointer-events-none absolute -bottom-16 -right-10 w-40 h-40 rounded-full bg-secondary/20 blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-500" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-foreground/20 to-transparent" />

              <div className="relative flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary-foreground/12 to-primary-foreground/4 backdrop-blur-md border border-primary-foreground/[0.10] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] flex items-center justify-center">
                <Icon className="text-primary-foreground drop-shadow-[0_0_8px_rgba(0,0,0,0.4)]" size={24} strokeWidth={2.25} />
              </div>
              <div className="relative">
                <h3 className="font-heading text-lg md:text-xl font-bold text-primary-foreground mb-1">
                  {title}
                </h3>
                <p className="font-body text-sm md:text-base text-primary-foreground/85 leading-relaxed">
                  {text}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#25D366] hover:bg-[#20bd5a] text-white font-heading font-bold uppercase tracking-wide px-10 py-4 transition-all hover:scale-105 shadow-lg rounded-full"
          >
            Conversar no WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
};

export default PorQueRenova;
