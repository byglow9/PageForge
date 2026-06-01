import { campaigns } from "@/data/campaigns";
import CampaignCard from "./CampaignCard";

const CampaignHub = () => {
  return (
    <section id="viagens" className="py-20 md:py-28 bg-muted">
      <div className="container mx-auto px-4">
        <p className="font-accent text-lg italic text-secondary text-center mb-2">
          Escolha sua próxima aventura
        </p>
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary text-center mb-4">
          Nossas Viagens
        </h2>
        <p className="font-body text-muted-foreground text-center max-w-2xl mx-auto mb-14 leading-relaxed">
          Explore nossos roteiros exclusivos e encontre a viagem perfeita para você.
          Clique em uma campanha para ver todos os detalhes.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {campaigns
            .filter((campaign) => campaign.published !== false)
            .map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
        </div>
      </div>
    </section>
  );
};

export default CampaignHub;
