import { useEffect, useRef } from "react";
import Seo from "@/components/seo/Seo";
import Navbar from "@/components/campaigns/portugal/Navbar";
import Hero from "@/components/campaigns/portugal/Hero";
import SobreViagem from "@/components/campaigns/portugal/SobreViagem";
import Inclusos from "@/components/campaigns/portugal/Inclusos";
import Roteiro from "@/components/campaigns/portugal/Roteiro";
import PorQueRenova from "@/components/campaigns/portugal/PorQueRenova";
import Depoimentos from "@/components/campaigns/portugal/Depoimentos";
import InscrevaSe from "@/components/campaigns/portugal/InscrevaSe";
import Footer from "@/components/landing/Footer";
import WhatsAppFloat from "@/components/campaigns/portugal/WhatsAppFloat";

const Portugal = () => {
  const solidSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Viagem para Portugal | Renova Turismo"
        description="Roteiro cultural por Portugal com a Renova Turismo: Lisboa, Porto, Fátima e mais, com guias em português e hospedagem selecionada."
        path="/portugal"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "TouristTrip",
          name: "Viagem para Portugal",
          touristType: "Cultural",
          provider: { "@type": "TravelAgency", name: "Renova Turismo" },
        }}
      />
      <Navbar />
      <WhatsAppFloat />
      <Hero solidSectionRef={solidSectionRef} />
      {/* Sobre a Viagem floats over the hero image (no background) */}
      <div className="relative z-10">
        <SobreViagem />
      </div>
      {/* Remaining sections scroll up with solid background */}
      <div ref={solidSectionRef} className="relative z-10 bg-background">
        <Inclusos />
        <Roteiro />
        <PorQueRenova />
        <Depoimentos />
        <InscrevaSe />
        <Footer />
      </div>
    </div>
  );
};

export default Portugal;
