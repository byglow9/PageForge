import { useEffect } from "react";
import Seo from "@/components/seo/Seo";
import Hero from "@/components/lideres-evangelicos/Hero";
import JornadaCards from "@/components/lideres-evangelicos/JornadaCards";
import PorQueRenova from "@/components/lideres-evangelicos/PorQueRenova";
import Stats from "@/components/lideres-evangelicos/Stats";
import Depoimentos from "@/components/lideres-evangelicos/Depoimentos";
import Footer from "@/components/landing/Footer";

const LideresEvangelicos = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Pastores na Terra Santa | Renova Turismo";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Pastores na Terra Santa | Renova Turismo"
        description="Programa exclusivo da Renova Turismo para pastores líderes na Terra Santa: roteiros, formação e suporte completo para sua peregrinação."
        path="/lideres-evangelicos"
      />
      <Hero />
      <JornadaCards />
      <PorQueRenova />
      <Stats />
      <Depoimentos />
      <Footer />
    </div>
  );
};

export default LideresEvangelicos;
