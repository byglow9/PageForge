import { useEffect } from "react";
import Seo from "@/components/seo/Seo";
import Navbar from "@/components/campaigns/africa-do-sul-2/Navbar";
import Hero from "@/components/campaigns/africa-do-sul-2/Hero";
import SobreViagem from "@/components/campaigns/africa-do-sul-2/SobreViagem";
import Inclusos from "@/components/campaigns/africa-do-sul-2/Inclusos";
import Roteiro from "@/components/campaigns/africa-do-sul-2/Roteiro";
import PorQueRenova from "@/components/campaigns/africa-do-sul-2/PorQueRenova";
import Depoimentos from "@/components/campaigns/africa-do-sul-2/Depoimentos";
import InscrevaSe from "@/components/campaigns/africa-do-sul-2/InscrevaSe";
import Footer from "@/components/landing/Footer";

const AfricaDoSul2 = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Viagem para a África do Sul | Renova Turismo"
        description="Descubra as grandezas naturais da África do Sul com a Renova Turismo: safáris, Cidade do Cabo e roteiros culturais com guias em português."
        path="/africa-do-sul-2"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "TouristTrip",
          name: "Viagem para a África do Sul",
          touristType: "Cultural",
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

export default AfricaDoSul2;
