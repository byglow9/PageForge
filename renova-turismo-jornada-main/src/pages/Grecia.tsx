import { useEffect } from "react";
import Seo from "@/components/seo/Seo";
import Navbar from "@/components/campaigns/grecia/Navbar";
import Hero from "@/components/campaigns/grecia/Hero";
import SobreViagem from "@/components/campaigns/grecia/SobreViagem";
import Inclusos from "@/components/campaigns/grecia/Inclusos";
import Roteiro from "@/components/campaigns/grecia/Roteiro";
import PorQueRenova from "@/components/campaigns/grecia/PorQueRenova";
import Depoimentos from "@/components/campaigns/grecia/Depoimentos";
import InscrevaSe from "@/components/campaigns/grecia/InscrevaSe";
import Footer from "@/components/landing/Footer";

const Grecia = () => {
  useEffect(() => {
    window.scrollTo(0, 0);

    const gtagId = "G-HZD0F6TRYL";
    if (!document.querySelector(`script[src*="${gtagId}"]`)) {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${gtagId}`;
      document.head.appendChild(script);

      const inlineScript = document.createElement("script");
      inlineScript.textContent = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${gtagId}');
      `;
      document.head.appendChild(inlineScript);
    }
  }, []);

  return (
    <div className="theme-grecia min-h-screen bg-background">
      <Seo
        title="Viagem para a Grécia | Renova Turismo"
        description="Jornada cultural pela Grécia com a Renova Turismo: Atenas, Delfos, Meteora, Santorini e Mykonos, com guias em português e hospedagem selecionada."
        path="/grecia"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "TouristTrip",
          name: "Viagem para a Grécia",
          touristType: "Cultural",
          provider: { "@type": "TravelAgency", name: "Renova Turismo" },
          itinerary: {
            "@type": "ItemList",
            name: "Atenas, Delfos, Meteora, Santorini e Mykonos",
          },
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

export default Grecia;
