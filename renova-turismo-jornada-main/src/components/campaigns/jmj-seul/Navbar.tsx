import { useState, useEffect } from "react";
import { Menu, X, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import logoRenova from "@/assets/logo-renova.svg";

const WHATSAPP_URL =
  "https://api.whatsapp.com/send/?phone=5519998974721&text=Ol%C3%A1+Fabiola%21+Tenho+interesse+na+viagem+para+a+JMJ+Seul+2027+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.&type=phone_number&app_absent=0";

const navLinks = [
  { label: "Início", href: "#inicio" },
  { label: "Sobre A Viagem", href: "#sobre" },
  { label: "Roteiro", href: "#roteiro" },
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
      className={`fixed top-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-sm shadow-lg transition-all duration-[350ms] ease-in-out ${
        hidden ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between py-3 px-4 md:px-8">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors" aria-label="Voltar ao hub">
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
                <a href={link.href} className="font-body text-xs font-medium text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-block rounded-full bg-secondary px-6 py-2.5 font-heading text-sm font-semibold text-secondary-foreground hover:bg-secondary/90 transition-colors"
          >
            Saiba Mais
          </a>
        </div>
        <button className="md:hidden text-primary-foreground" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-primary border-t border-primary-foreground/10 pb-4">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="block px-6 py-3 font-heading text-sm text-primary-foreground/80 hover:text-primary-foreground transition-colors">
              {link.label}
            </a>
          ))}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block mx-6 mt-3 text-center rounded-full bg-secondary px-6 py-2.5 font-heading text-sm font-semibold text-secondary-foreground hover:bg-secondary/90 transition-colors"
          >
            Saiba Mais
          </a>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
