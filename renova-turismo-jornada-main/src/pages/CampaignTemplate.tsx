import { useEffect } from "react";
import Navbar from "@/components/campaigns/template/Navbar";
import Hero from "@/components/campaigns/template/Hero";
import SobreViagem from "@/components/campaigns/template/SobreViagem";
import Inclusos from "@/components/campaigns/template/Inclusos";
import Roteiro from "@/components/campaigns/template/Roteiro";
import PorQueRenova from "@/components/campaigns/template/PorQueRenova";
import Depoimentos from "@/components/campaigns/template/Depoimentos";
import InscrevaSe from "@/components/campaigns/template/InscrevaSe";
import Footer from "@/components/landing/Footer";

/**
 * =============================================
 * 📋 TEMPLATE DE CAMPANHA — GUIA DE EDIÇÃO
 * =============================================
 *
 * Para criar uma nova campanha, duplique esta pasta
 * (src/components/campaigns/template/) e edite os
 * campos marcados com "EDITAR:" em cada componente:
 *
 * 1. Hero.tsx       → Título, subtítulo, imagem de fundo, CTA
 * 2. SobreViagem.tsx → Descrição, datas, cidades, significado
 * 3. Roteiro.tsx     → Slides do roteiro dia a dia (imagens + textos)
 * 4. Inclusos.tsx    → Benefícios inclusos no pacote
 * 5. PorQueRenova.tsx → Motivos + fotos do grupo (opcional)
 * 6. Depoimentos.tsx → Depoimentos de clientes
 * 7. InscrevaSe.tsx  → Número WhatsApp, destino, nome do líder
 * 8. Navbar.tsx      → Texto do CTA (geralmente não precisa mudar)
 *
 * Depois, crie uma nova rota em src/App.tsx apontando
 * para esta página com o path desejado.
 * =============================================
 */

const CampaignTemplate = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <SobreViagem />
      <Inclusos />
      <Roteiro />
      <PorQueRenova />
      <Depoimentos />
      <InscrevaSe />
      <Footer />
    </div>
  );
};

export default CampaignTemplate;
