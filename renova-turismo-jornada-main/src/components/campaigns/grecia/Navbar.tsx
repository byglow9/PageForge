import { useState, useEffect } from "react";
import { Menu, X, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import logoRenova from "@/assets/logo-renova.svg";

const navLinks = [
  { label: "Início", href: "#inicio" },
  { label: "Sobre", href: "#sobre" },
  { label: "Roteiro", href: "#roteiro" },
  { label: "Contato", href: "#contato" },
];

const WHATSAPP =
  "https://api.whatsapp.com/send/?phone=5519992016125&text=Ol%C3%A1%21+Tenho+interesse+na+viagem+para+a+Gr%C3%A9cia+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.&type=phone_number&app_absent=0";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-[350ms] ease-in-out ${
        scrolled ? "bg-primary/85 backdrop-blur-xl backdrop-saturate-150 shadow-lg border-b border-primary-foreground/10" : "bg-transparent"
      } ${hidden ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"}`}
    >


      <div className="max-w-7xl mx-auto flex items-center justify-between py-4 px-5 md:px-10">
        <div className="flex items-center gap-5 md:gap-6">
          <Link to="/" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors shrink-0" aria-label="Voltar ao hub">
            <ArrowLeft size={20} />
          </Link>
          <a href="#inicio" className="shrink-0">
            <img src={logoRenova} alt="Renova Turismo" className="h-9 md:h-12 brightness-0 invert" />
          </a>
        </div>
        <div className="hidden md:flex items-center gap-10">
          <ul className="flex items-center gap-8">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="font-body text-xs uppercase tracking-[0.18em] font-medium text-primary-foreground/85 hover:text-primary-foreground transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-secondary px-6 py-2.5 font-body text-xs uppercase tracking-[0.18em] font-semibold text-secondary-foreground hover:bg-secondary/90 transition-colors"
          >
            Reservar
          </a>
        </div>
        <button className="md:hidden text-primary-foreground" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-primary/95 backdrop-blur-md border-t border-primary-foreground/10 pb-4">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block px-6 py-3 font-body text-sm uppercase tracking-widest text-primary-foreground/85 hover:text-primary-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block mx-6 mt-3 text-center rounded-full bg-secondary px-6 py-2.5 font-body text-xs uppercase tracking-widest font-semibold text-secondary-foreground hover:bg-secondary/90 transition-colors"
          >
            Reservar
          </a>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
