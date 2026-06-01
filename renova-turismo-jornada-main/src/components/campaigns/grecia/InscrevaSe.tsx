import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const WHATSAPP_PHONE = "5519992016125";

const InscrevaSe = () => {
  const [formData, setFormData] = useState({ nome: "", email: "", telefone: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { nome, email, telefone } = formData;

    supabase.functions
      .invoke("send-contact-email", {
        body: { nome, email, telefone, campaign: "Viagem Grécia" },
      })
      .catch((err) => console.error("send-contact-email error:", err));

    const message = `Olá! Meu nome é ${nome}, meu e-mail é ${email} e meu telefone é ${telefone}. Gostaria de mais informações sobre a viagem à Grécia.`;
    window.open(
      `https://api.whatsapp.com/send/?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(
        message
      )}&type=phone_number&app_absent=0`,
      "_blank"
    );
    setSubmitted(true);
  };

  return (
    <section id="contato" className="py-16 md:py-28 bg-background">
      <div className="container mx-auto px-5 md:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center max-w-6xl mx-auto">
          <div>
            <p className="font-accent italic text-lg text-secondary mb-3">
              Vagas limitadas
            </p>
            <h2 className="font-heading uppercase text-4xl md:text-5xl lg:text-6xl text-primary leading-[0.95] mb-2">
              Garanta seu
            </h2>
            <h2 className="font-heading uppercase text-4xl md:text-5xl lg:text-6xl leading-[0.95] display-outline-dark mb-8">
              Lugar
            </h2>
            <div className="w-16 h-px bg-secondary mb-8" />
            <p className="font-body text-muted-foreground text-base md:text-lg leading-relaxed mb-8">
              Entre em contato com nossa equipe e dê o primeiro passo rumo à sua jornada
              pela Grécia. Atendimento personalizado, sem compromisso.
            </p>
            <a
              href={`https://api.whatsapp.com/send/?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(
                "Olá! Gostaria de mais informações sobre a viagem à Grécia."
              )}&type=phone_number&app_absent=0`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-secondary hover:bg-secondary/90 text-secondary-foreground font-body uppercase tracking-[0.18em] text-xs md:text-sm font-semibold px-10 py-4 rounded-full transition-all hover:scale-105 shadow-lg"
            >
              Falar no WhatsApp
            </a>
          </div>

          <div className="bg-muted rounded-2xl p-8 md:p-10 shadow-xl">
            <h3 className="font-heading uppercase text-xl text-primary mb-6 text-center">
              Receba a proposta
            </h3>
            {submitted ? (
              <div className="text-center py-8">
                <p className="font-heading uppercase text-primary mb-2">
                  Obrigado pelo interesse!
                </p>
                <p className="font-body text-muted-foreground text-sm">
                  Você será redirecionado ao WhatsApp para finalizar o contato.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="grecia-nome" className="font-body text-foreground text-xs uppercase tracking-widest">
                    Nome completo
                  </Label>
                  <Input
                    id="grecia-nome"
                    placeholder="Seu nome"
                    required
                    maxLength={100}
                    value={formData.nome}
                    onChange={(e) => setFormData((p) => ({ ...p, nome: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grecia-email" className="font-body text-foreground text-xs uppercase tracking-widest">
                    E-mail
                  </Label>
                  <Input
                    id="grecia-email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                    maxLength={255}
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grecia-telefone" className="font-body text-foreground text-xs uppercase tracking-widest">
                    Telefone / WhatsApp
                  </Label>
                  <Input
                    id="grecia-telefone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    required
                    maxLength={20}
                    value={formData.telefone}
                    onChange={(e) => setFormData((p) => ({ ...p, telefone: e.target.value }))}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-body uppercase tracking-[0.18em] text-xs font-semibold px-8 py-4 rounded-full transition-all hover:scale-[1.02] shadow-lg"
                >
                  Garantir Meu Lugar
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default InscrevaSe;
