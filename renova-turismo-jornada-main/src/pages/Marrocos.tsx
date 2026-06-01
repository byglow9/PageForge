import { useEffect } from "react";
import Seo from "@/components/seo/Seo";
import Navbar from "@/components/campaigns/marrocos/Navbar";
import Hero from "@/components/campaigns/marrocos/Hero";
import SobreViagem from "@/components/campaigns/marrocos/SobreViagem";
import Inclusos from "@/components/campaigns/marrocos/Inclusos";
import Roteiro from "@/components/campaigns/marrocos/Roteiro";
import PorQueRenova from "@/components/campaigns/marrocos/PorQueRenova";
import Depoimentos from "@/components/campaigns/marrocos/Depoimentos";
import InscrevaSe from "@/components/campaigns/marrocos/InscrevaSe";
import Footer from "@/components/landing/Footer";

const Marrocos = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Viagem ao Marrocos 2026 | Renova Turismo"
        description="Roteiro pelo Marrocos com a Renova Turismo: Casablanca, Fez, Marrakech e Deserto do Saara. Guias em português, hotéis selecionados e total conforto."
        path="/marrocos"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "TouristTrip",
          name: "Viagem ao Marrocos",
          touristType: "Cultural",
          provider: { "@type": "TravelAgency", name: "Renova Turismo" },
          itinerary: { "@type": "ItemList", name: "Casablanca, Meknes, Fez, Marrakech e Deserto do Saara" },
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

export default Marrocos;
