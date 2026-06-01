import { MessageCircle } from "lucide-react";

const WhatsAppFloat = () => {
  return (
    <a
      href="https://api.whatsapp.com/send/?phone=5519936186395&text=Ol%C3%A1%21+Gostaria+de+mais+informa%C3%A7%C3%B5es+sobre+a+peregrina%C3%A7%C3%A3o+para+Portugal.+Aguardo+retorno&type=phone_number&app_absent=0"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fale conosco no WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#25D366] hover:bg-[#1ebe57] text-white shadow-lg hover:scale-110 transition-all animate-fade-in-up"
    >
      <MessageCircle className="w-7 h-7 md:w-8 md:h-8" fill="currentColor" />
    </a>
  );
};

export default WhatsAppFloat;
