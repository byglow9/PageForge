import { useState, useEffect } from "react";
import { Menu, X, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import logoRenova from "@/assets/logo-renova.svg";

const navLinks = [
  { label: "Início", href: "#inicio" },
  { label: "Sobre A Viagem", href: "#sobre" },
  { label: "Destinos", href: "#roteiro" },
  { label: "Contato", href: "#contato" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;

    const observer = new IntersectionObserver(
      ([entry]) => setHidden(entry.isIntersecting),
      { threshold: 0 }
    );

    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 bg-turkey-red/95 backdrop-blur-sm shadow-lg shadow-turkey-red-dark/20 transition-all duration-[350ms] ease-in-out ${
        hidden ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between py-3 px-4 md:px-8">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-turkey-white/70 hover:text-turkey-white transition-colors" aria-label="Voltar ao hub">
            <ArrowLeft size={20} />
          </Link>
          <a href="#inicio">
            <img src={logoRenova} alt="Renova Turismo" className="h-10 md:h-12" />
          </a>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <ul className="flex items-center gap-8">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="font-body text-xs font-medium text-turkey-white/80 hover:text-turkey-white transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="https://api.whatsapp.com/send/?phone=5519989542633&text=Ol%C3%A1%21+Encontrei+voc%C3%AAs+pelo+Google+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.+Aguardo+retorno&type=phone_number&app_absent=0"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-block rounded-full bg-turkey-white px-6 py-2.5 font-heading text-sm font-semibold text-turkey-red hover:bg-turkey-white/90 transition-colors"
          >
            Saiba Mais
          </a>
        </div>
        <button
          className="md:hidden text-turkey-white"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-turkey-red-dark border-t border-turkey-white/10 pb-4">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block px-6 py-3 font-heading text-sm text-turkey-white/80 hover:text-turkey-white transition-colors"
            >
              {link.label}
            </a>
          ))}
          <a
            href="https://api.whatsapp.com/send/?phone=5519989542633&text=Ol%C3%A1%21+Encontrei+voc%C3%AAs+pelo+Google+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.+Aguardo+retorno&type=phone_number&app_absent=0"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block mx-6 mt-3 text-center rounded-full bg-turkey-white px-6 py-2.5 font-heading text-sm font-semibold text-turkey-red hover:bg-turkey-white/90 transition-colors"
          >
            Saiba Mais
          </a>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
