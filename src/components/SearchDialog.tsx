import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Search, FolderOpen, Clock, CalendarDays, Users, UserSquare2, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import { formatarData } from "@/lib/dates";
import { useAuth } from "@/contexts/AuthContext";

interface Resultado {
  key: string;
  tipo: string;
  titulo: string;
  desc: string;
  icon: LucideIcon;
  url: string;
}

const LIMITE = 12;

/** Normaliza para busca: minúsculas e sem acentos ("Ação" encontra "acao"). */
const norm = (s?: string | null) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Busca global nos dados reais (processos, partes, prazos, compromissos e usuários). */
export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Resultado[]>([]);
  const navigate = useNavigate();
  const { podeGerenciarUsuarios } = useAuth();

  useEffect(() => {
    const q = norm(query.trim());
    if (!q) {
      setResults([]);
      return;
    }
    let cancelado = false;
    const has = (...campos: (string | undefined | null)[]) => campos.some((c) => norm(c).includes(q));

    (async () => {
      const [processos, partes, prazos, eventos, users] = await Promise.all([
        db.processos.toArray(),
        db.partes.toArray(),
        db.prazos.toArray(),
        db.eventos.toArray(),
        podeGerenciarUsuarios ? db.users.toArray() : Promise.resolve([]),
      ]);
      const out: Resultado[] = [
        ...processos
          .filter((p) => has(p.titulo, p.numero, p.areaDireito))
          .map((p) => ({ key: `p-${p.id}`, tipo: "processo", titulo: p.titulo, desc: p.numero || p.areaDireito || "Sem número", icon: FolderOpen, url: `/processos/${p.id}` })),
        ...partes
          .filter((p) => has(p.nome, p.razaoSocial, p.cpfCnpj, p.email))
          .map((p) => ({ key: `pt-${p.id}`, tipo: "parte", titulo: p.nome || p.razaoSocial || "Sem nome", desc: p.cpfCnpj || p.email || p.tipoPessoa || "", icon: UserSquare2, url: `/partes/${p.id}` })),
        ...prazos
          .filter((p) => has(p.titulo, p.descricao))
          .map((p) => ({ key: `pz-${p.id}`, tipo: "prazo", titulo: p.titulo, desc: `Vence em ${formatarData(p.dataLimite)}${p.status === "cumprido" ? " · cumprido" : ""}`, icon: Clock, url: p.processoId ? `/processos/${p.processoId}` : "/prazos" })),
        ...eventos
          .filter((e) => has(e.titulo, e.descricao, e.local))
          .map((e) => ({ key: `e-${e.id}`, tipo: "compromisso", titulo: e.titulo, desc: `${formatarData(e.data)}${e.horaInicio ? ` · ${e.horaInicio}` : ""}`, icon: CalendarDays, url: e.processoId ? `/processos/${e.processoId}` : "/agenda" })),
        ...users
          .filter((u) => has(u.nome, u.email))
          .map((u) => ({ key: `u-${u.id}`, tipo: "usuário", titulo: u.nome, desc: u.email, icon: Users, url: "/usuarios" })),
      ];
      if (!cancelado) setResults(out.slice(0, LIMITE));
    })();
    return () => {
      cancelado = true;
    };
  }, [query, podeGerenciarUsuarios]);

  const fechar = (v: boolean) => {
    onOpenChange(v);
    if (!v) setQuery("");
  };

  const handleSelect = (url: string) => {
    navigate(url);
    fechar(false);
  };

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0">
        <DialogTitle className="sr-only">Buscar</DialogTitle>
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar processos, partes, prazos, compromissos..."
            className="flex-1 h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            autoFocus
          />
        </div>
        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto py-2">
            {results.map((item) => (
              <button
                key={item.key}
                onClick={() => handleSelect(item.url)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
              >
                <item.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.titulo}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                </div>
                <span className="text-[10px] uppercase text-muted-foreground bg-muted rounded px-1.5 py-0.5">{item.tipo}</span>
              </button>
            ))}
          </div>
        )}
        {query.trim().length > 0 && results.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhum resultado encontrado</div>
        )}
        {query.trim().length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">Digite para buscar processos, partes, prazos, compromissos...</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
