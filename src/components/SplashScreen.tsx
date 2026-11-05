import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { EDICAO } from "@/lib/edicao";

const MIN_DURATION_MS = 2300; // tempo mínimo para a animação completar
const EXIT_MS = 600; // duração do fade-out

/**
 * Tela de abertura animada. Fica visível até a animação terminar E o app
 * estar pronto (`ready`), depois se dissolve revelando o conteúdo.
 */
export function SplashScreen({ ready }: { ready: boolean }) {
  const [minElapsed, setMinElapsed] = useState(false);
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setMinElapsed(true), reduced ? 300 : MIN_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (ready && minElapsed && phase === "in") setPhase("out");
  }, [ready, minElapsed, phase]);

  // Efeito separado: se ficasse no efeito acima, a mudança de `phase` cancelaria
  // este timer e a tela de abertura nunca sairia do DOM.
  useEffect(() => {
    if (phase !== "out") return;
    const t = setTimeout(() => setPhase("gone"), EXIT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div className={`splash ${phase === "out" ? "splash--out" : ""}`} role="status" aria-label="Carregando Lexco">
      <div className="splash__glow" />
      <div className="splash__content">
        <div className="splash__logo">
          <span className="splash__ring" />
          <span className="splash__ring splash__ring--2" />
          <Scale className="splash__icon" strokeWidth={1.75} />
        </div>
        <h1 className="splash__title" aria-hidden="true">
          {"Lexco".split("").map((ch, i) => (
            <span key={i} style={{ animationDelay: `${900 + i * 90}ms` }}>
              {ch}
            </span>
          ))}
        </h1>
        <p className="splash__tagline">{EDICAO.edicao === "spu" ? "SPU · Processos Administrativos" : "Gestão Jurídica"}</p>
        <div className="splash__bar">
          <span />
        </div>
      </div>
    </div>
  );
}
