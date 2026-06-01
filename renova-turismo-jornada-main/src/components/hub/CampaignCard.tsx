import { Link } from "react-router-dom";
import { Calendar, ArrowRight } from "lucide-react";
import type { Campaign } from "@/data/campaigns";

interface CampaignCardProps {
  campaign: Campaign;
}

const CampaignCard = ({ campaign }: CampaignCardProps) => {
  return (
    <Link
      to={campaign.slug}
      className="group bg-card rounded-xl overflow-hidden shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300"
    >
      <div className="relative h-56 md:h-64 overflow-hidden">
        <img
          src={campaign.image}
          alt={campaign.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-primary/20 to-transparent" />
        {campaign.badge && (
          <span className="absolute top-4 left-4 bg-secondary text-secondary-foreground text-xs font-heading font-bold px-3 py-1 rounded-full">
            {campaign.badge}
          </span>
        )}
        <div className="absolute bottom-4 left-5 right-5">
          <p className="text-xs uppercase tracking-widest text-secondary font-body font-semibold mb-1">
            {campaign.subtitle}
          </p>
          <h3 className="font-heading text-xl md:text-2xl font-bold text-primary-foreground">
            {campaign.title}
          </h3>
        </div>
      </div>
      <div className="p-6">
        <div className="flex items-center gap-2 text-secondary mb-3">
          <Calendar size={16} />
          <span className="font-body text-sm font-medium">{campaign.date}</span>
        </div>
        <p className="font-body text-muted-foreground text-sm leading-relaxed mb-4">
          {campaign.description}
        </p>
        <div className="flex items-center gap-2 text-secondary font-heading font-semibold text-sm group-hover:gap-3 transition-all">
          Ver detalhes <ArrowRight size={16} />
        </div>
      </div>
    </Link>
  );
};

export default CampaignCard;
