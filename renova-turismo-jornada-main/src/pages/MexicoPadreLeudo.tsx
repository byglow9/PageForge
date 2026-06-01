import { useEffect } from "react";
import Seo from "@/components/seo/Seo";
import Navbar from "@/components/campaigns/mexico-padre-leudo/Navbar";
import Hero from "@/components/campaigns/mexico-padre-leudo/Hero";
import SobreViagem from "@/components/campaigns/mexico-padre-leudo/SobreViagem";
import Inclusos from "@/components/campaigns/mexico-padre-leudo/Inclusos";
import Roteiro from "@/components/campaigns/mexico-padre-leudo/Roteiro";
import PorQueRenova from "@/components/campaigns/mexico-padre-leudo/PorQueRenova";
import Depoimentos from "@/components/campaigns/mexico-padre-leudo/Depoimentos";
import InscrevaSe from "@/components/campaigns/mexico-padre-leudo/InscrevaSe";
import Footer from "@/components/landing/Footer";

const MexicoPadreLeudo = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Peregrinação ao México com Pe Leudo Santos | Renova Turismo"
        description="Peregrinação à Basílica de Guadalupe e roteiro cultural pelo México com o Pe Leudo Santos e a Renova Turismo. Guias em português e hospedagem selecionada."
        path="/mexico-padre-leudo"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "TouristTrip",
          name: "Peregrinação ao México com Pe Leudo Santos",
          touristType: "Religioso",
          provider: { "@type": "TravelAgency", name: "Renova Turismo" },
        }}
      />
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

export default MexicoPadreLeudo;
