import { useEffect } from "react";
import Seo from "@/components/seo/Seo";
import HubNavbar from "@/components/hub/HubNavbar";
import HubHero from "@/components/hub/HubHero";
import CampaignHub from "@/components/hub/CampaignHub";
import PorQueRenova from "@/components/landing/PorQueRenova";
import Footer from "@/components/landing/Footer";

const Index = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Renova Turismo — Roteiros Culturais e Peregrinações"
        description="Conheça as viagens da Renova Turismo: roteiros culturais e peregrinações com guias em português, hotéis selecionados e experiências inesquecíveis."
        path="/"
      />
      <HubNavbar />
      <HubHero />
      <CampaignHub />
      <PorQueRenova />
      
      <Footer />
    </div>
  );
};

export default Index;
