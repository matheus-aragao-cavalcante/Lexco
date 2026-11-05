import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Bell, Clock, AlertTriangle, CalendarDays, X, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { hojeISO } from "@/lib/dates";
import { useAuth } from "@/contexts/AuthContext";
import { carregarLidas, gerarNotificacoes, salvarLidas, type Notificacao } from "@/lib/notificacoes";

const tipoIcon = {
  urgente: <AlertTriangle className="h-4 w-4 text-destructive" />,
  aviso: <Clock className="h-4 w-4 text-warning" />,
  info: <CalendarDays className="h-4 w-4 text-muted-foreground" />,
};

/** Sino de notificações: prazos atrasados/hoje/amanhã e compromissos de hoje/amanhã, a partir dos dados reais. */
export function NotificationsPanel() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [hoje, setHoje] = useState(hojeISO());
  const [lidas, setLidas] = useState<Set<string>>(() => (currentUser ? carregarLidas(currentUser.id) : new Set()));

  // Vira o dia com o app aberto: recalcula.
  useEffect(() => {
    const t = setInterval(() => setHoje(hojeISO()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (currentUser) setLidas(carregarLidas(currentUser.id));
  }, [currentUser]);

  // Reativo: atualiza sozinho quando prazos/eventos mudam.
  const dados = useLiveQuery(async () => ({ prazos: await db.prazos.toArray(), eventos: await db.eventos.toArray() }), []);

  const notificacoes = useMemo<Notificacao[]>(
    () => (dados ? gerarNotificacoes({ ...dados, prefs: currentUser?.preferencias, hoje }) : []),
    [dados, currentUser?.preferencias, hoje],
  );
  const naoLidas = notificacoes.filter((n) => !lidas.has(n.id)).length;

  const marcar = (ids: string[]) => {
    if (!currentUser) return;
    const novo = new Set([...lidas, ...ids]);
    setLidas(novo);
    salvarLidas(currentUser.id, novo, notificacoes);
  };

  const abrir = (n: Notificacao) => {
    marcar([n.id]);
    setOpen(false);
    navigate(n.url);
  };

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" className="relative" onClick={() => setOpen(!open)} aria-label="Notificações">
        <Bell className="h-5 w-5 text-muted-foreground" />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-elevated z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notificacoes.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <CheckCheck className="h-6 w-6 mx-auto text-success mb-2" />
                  <p className="text-sm text-foreground">Tudo em dia</p>
                  <p className="text-xs text-muted-foreground">Nenhum prazo ou compromisso próximo.</p>
                </div>
              )}
              {notificacoes.map((n) => {
                const lida = lidas.has(n.id);
                return (
                  <button
                    key={n.id}
                    onClick={() => abrir(n)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors ${!lida ? "bg-primary/5" : ""}`}
                  >
                    <div className="mt-0.5">{tipoIcon[n.tipo]}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!lida ? "font-medium text-foreground" : "text-muted-foreground"}`}>{n.titulo}</p>
                      <p className="text-xs text-muted-foreground truncate">{n.descricao}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {naoLidas > 0 && (
              <div className="px-4 py-2 border-t border-border">
                <button onClick={() => marcar(notificacoes.map((n) => n.id))} className="text-xs text-primary hover:underline w-full text-center">
                  Marcar todas como lidas
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
