import { useEffect } from "react";
import Seo from "@/components/seo/Seo";
import Navbar from "@/components/campaigns/leste-europeu/Navbar";
import Hero from "@/components/campaigns/leste-europeu/Hero";
import SobreViagem from "@/components/campaigns/leste-europeu/SobreViagem";
import Inclusos from "@/components/campaigns/leste-europeu/Inclusos";
import Roteiro from "@/components/campaigns/leste-europeu/Roteiro";
import PorQueRenova from "@/components/campaigns/leste-europeu/PorQueRenova";
import Depoimentos from "@/components/campaigns/leste-europeu/Depoimentos";
import InscrevaSe from "@/components/campaigns/leste-europeu/InscrevaSe";
import Footer from "@/components/landing/Footer";

const LesteEuropeu = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Viagem ao Leste Europeu | Renova Turismo"
        description="Roteiro pelo Leste Europeu: Budapeste, Viena, Bratislava e Praga com a Renova Turismo. Guias em português, hotéis selecionados e total conforto."
        path="/leste-europeu"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "TouristTrip",
          name: "Viagem ao Leste Europeu",
          touristType: "Cultural",
          provider: { "@type": "TravelAgency", name: "Renova Turismo" },
          itinerary: { "@type": "ItemList", name: "Budapeste, Viena, Bratislava e Praga" },
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

export default LesteEuropeu;
