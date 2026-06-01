import { useEffect } from "react";
import Seo from "@/components/seo/Seo";
import Navbar from "@/components/campaigns/padre-leudo/Navbar";
import Hero from "@/components/campaigns/padre-leudo/Hero";
import SobreViagem from "@/components/campaigns/padre-leudo/SobreViagem";
import Inclusos from "@/components/campaigns/padre-leudo/Inclusos";
import Roteiro from "@/components/campaigns/padre-leudo/Roteiro";
import PorQueRenova from "@/components/campaigns/padre-leudo/PorQueRenova";
import Depoimentos from "@/components/campaigns/padre-leudo/Depoimentos";
import InscrevaSe from "@/components/campaigns/padre-leudo/InscrevaSe";
import Footer from "@/components/landing/Footer";

const TurquiaPadreLeudo = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Peregrinação à Turquia com Pe Leudo Santos | Renova Turismo"
        description="Peregrinação cultural e histórica à Turquia com o Pe Leudo Santos e a Renova Turismo. Roteiro completo, guias em português e total conforto."
        path="/turquia-padre-leudo"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "TouristTrip",
          name: "Peregrinação à Turquia com Pe Leudo Santos",
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

export default TurquiaPadreLeudo;
