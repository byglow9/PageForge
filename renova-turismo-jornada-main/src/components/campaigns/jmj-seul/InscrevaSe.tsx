import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const FABIOLA_WHATSAPP = "5519998974721";

const InscrevaSe = () => {
  const [formData, setFormData] = useState({ nome: "", email: "", telefone: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { nome, email, telefone } = formData;

    supabase.functions
      .invoke("send-contact-email", {
        body: {
          nome,
          email,
          telefone,
          campaign: "JMJ Seul 2027",
        },
      })
      .catch((err) => console.error("send-contact-email error:", err));

    const message = `Olá Fabiola! Meu nome é ${nome}, meu e-mail é ${email} e meu telefone é ${telefone}. Gostaria de mais informações sobre a viagem para a JMJ Seul 2027.`;
    window.open(
      `https://api.whatsapp.com/send/?phone=${FABIOLA_WHATSAPP}&text=${encodeURIComponent(message)}&type=phone_number&app_absent=0`,
      "_blank"
    );
    setSubmitted(true);
  };

  return (
    <section id="contato" className="py-12 md:py-16 bg-muted">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center max-w-5xl mx-auto">
          <div className="text-center md:text-left">
            <p className="font-accent text-lg italic text-secondary mb-2">
              Vagas Limitadas!
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-6">
              Inscreva-se Agora
            </h2>
            <p className="font-body text-muted-foreground text-lg mb-8">
              Vagas limitadas! Entre em contato conosco e garanta seu lugar na Jornada
              Mundial da Juventude em Seul — uma experiência única ao lado do Papa.
            </p>
            <a
              href={`https://api.whatsapp.com/send/?phone=${FABIOLA_WHATSAPP}&text=${encodeURIComponent(
                "Olá Fabiola! Gostaria de mais informações sobre a viagem para a JMJ Seul 2027."
              )}&type=phone_number&app_absent=0`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-secondary hover:bg-secondary/90 text-secondary-foreground font-heading font-bold text-lg px-12 py-4 rounded-full transition-all hover:scale-105 shadow-lg"
            >
              Vagas Limitadas!
            </a>
          </div>

          <div className="bg-card rounded-2xl shadow-lg p-8">
            <h3 className="font-heading text-xl font-bold text-primary mb-6 text-center">
              Preencha seus dados
            </h3>
            {submitted ? (
              <div className="text-center py-8">
                <p className="font-heading text-lg font-semibold text-primary mb-2">
                  Obrigado pelo interesse!
                </p>
                <p className="text-muted-foreground">
                  Você será redirecionado ao WhatsApp para finalizar o contato.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="jmj-nome" className="font-body text-foreground">Nome completo</Label>
                  <Input id="jmj-nome" placeholder="Seu nome" required maxLength={100} value={formData.nome} onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jmj-email" className="font-body text-foreground">E-mail</Label>
                  <Input id="jmj-email" type="email" placeholder="seu@email.com" required maxLength={255} value={formData.email} onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jmj-telefone" className="font-body text-foreground">Telefone / WhatsApp</Label>
                  <Input id="jmj-telefone" type="tel" placeholder="(00) 00000-0000" required maxLength={20} value={formData.telefone} onChange={(e) => setFormData((prev) => ({ ...prev, telefone: e.target.value }))} />
                </div>
                <button type="submit" className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-heading font-bold text-lg px-8 py-4 rounded-full transition-all hover:scale-105 shadow-lg">
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
