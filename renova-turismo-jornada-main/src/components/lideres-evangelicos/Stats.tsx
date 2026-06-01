import { useEffect, useRef, useState } from "react";

const stats = [
  { value: 20, prefix: "+", suffix: "", label: "anos de experiência" },
  { value: 10000, prefix: "+", suffix: "", label: "peregrinos embarcados" },
  { value: 620, prefix: "+", suffix: "", label: "grupos realizados" },
];

const formatNumber = (n: number) => n.toLocaleString("pt-BR");

const useCountUp = (target: number, start: boolean, duration = 2000) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, start, duration]);

  return value;
};

const StatItem = ({
  value,
  prefix,
  suffix,
  label,
  start,
}: {
  value: number;
  prefix: string;
  suffix: string;
  label: string;
  start: boolean;
}) => {
  const current = useCountUp(value, start);
  return (
    <div className="px-4">
      <p className="font-heading text-5xl md:text-6xl lg:text-7xl font-extrabold mb-3 text-secondary-foreground tracking-tight tabular-nums">
        {prefix}
        {formatNumber(current)}
        {suffix}
      </p>
      <p className="font-body text-sm md:text-base uppercase tracking-[0.15em] text-secondary-foreground/85">
        {label}
      </p>
    </div>
  );
};

const Stats = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setStarted(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-16 md:py-20 bg-secondary text-secondary-foreground"
    >
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6 max-w-5xl mx-auto text-center">
          {stats.map((s) => (
            <StatItem key={s.label} {...s} start={started} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
