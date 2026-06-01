import { useEffect } from "react";
import Seo from "@/components/seo/Seo";
import Navbar from "@/components/campaigns/jmj-seul/Navbar";
import Hero from "@/components/campaigns/jmj-seul/Hero";
import SobreViagem from "@/components/campaigns/jmj-seul/SobreViagem";
import Inclusos from "@/components/campaigns/jmj-seul/Inclusos";
import Roteiro from "@/components/campaigns/jmj-seul/Roteiro";
import PorQueRenova from "@/components/campaigns/jmj-seul/PorQueRenova";
import Depoimentos from "@/components/campaigns/jmj-seul/Depoimentos";
import InscrevaSe from "@/components/campaigns/jmj-seul/InscrevaSe";
import Footer from "@/components/landing/Footer";

const JmjSeul = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="JMJ Seul 2027 | Jornada Mundial da Juventude — Renova Turismo"
        description="Viva a JMJ Seul 2027 na Coreia do Sul com a Renova Turismo: roteiro completo, voos, hotéis, guias em português e acompanhamento espiritual."
        path="/jmj-seul-2027"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "TouristTrip",
          name: "JMJ Seul 2027 — Jornada Mundial da Juventude",
          touristType: "Peregrinação Católica",
          provider: { "@type": "TravelAgency", name: "Renova Turismo" },
          itinerary: { "@type": "ItemList", name: "Seul, principais eventos da JMJ e Busan" },
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

export default JmjSeul;
