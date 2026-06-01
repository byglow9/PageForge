import { Star } from "lucide-react";
import googleReviewsImg from "@/assets/google-reviews.png";

const GOOGLE_REVIEWS_URL =
  "https://www.google.com/search?kgmid=/g/11b746bhvy&hl=pt-BR&q=Renova+Turismo&shndl=30&source=sh/x/loc/osrp/m5/1&kgs=6bfd58b95fd5825d&utm_source=sh/x/loc/osrp/m5/1#lrd=0x94c8c6187fb4abcb:0x11b1a0b81404195,1,,,,";

const GoogleReviewsCard = () => {
  return (
    <a
      href={GOOGLE_REVIEWS_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Ver as avaliações da Renova Turismo no Google"
      className="block max-w-4xl mx-auto mt-14 relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl"
    >
      <div
        className="absolute inset-0 bg-gradient-to-r from-secondary/10 via-primary/5 to-secondary/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"
        aria-hidden="true"
      />
      <div className="relative bg-card border border-border/60 rounded-2xl px-6 py-7 md:px-10 md:py-8 shadow-sm group-hover:shadow-md group-hover:-translate-y-0.5 transition-all duration-500 ease-out flex flex-col md:flex-row items-center gap-6 md:gap-10 text-center md:text-left cursor-pointer">
        <div className="flex items-center gap-4 shrink-0">
          <img
            src={googleReviewsImg}
            alt="Renova Turismo - 5,0 estrelas no Google com mais de 1.034 avaliações"
            className="h-16 md:h-20 object-contain"
          />
          <div className="hidden md:block w-px h-16 bg-border" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-center md:justify-start gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="text-yellow-500 fill-yellow-500" size={18} />
            ))}
          </div>
          <p className="font-heading text-xl md:text-2xl font-bold text-primary leading-tight">
            A mais bem avaliada do Brasil.
          </p>
          <p className="font-body text-sm md:text-base text-muted-foreground mt-2 leading-relaxed">
            5,0 estrelas — uma reputação construída viagem após viagem, com cuidado, confiança e experiências inesquecíveis.
          </p>
        </div>
      </div>
    </a>
  );
};

export default GoogleReviewsCard;
