import { useState } from "react";
import { Bell, Clock, AlertTriangle, CheckCircle2, CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const notificacoes = [
  { id: 1, titulo: "Prazo vence hoje", desc: "Contestação - Silva vs Santos", tipo: "urgente", tempo: "Agora", lida: false },
  { id: 2, titulo: "Prazo vence hoje", desc: "Recurso de Apelação - Empresa ABC", tipo: "urgente", tempo: "1h atrás", lida: false },
  { id: 3, titulo: "Prazo vence amanhã", desc: "Juntada de Documentos - Pereira", tipo: "aviso", tempo: "2h atrás", lida: false },
  { id: 4, titulo: "Audiência agendada", desc: "Conciliação - Caso Ferreira às 11:00", tipo: "info", tempo: "3h atrás", lida: true },
  { id: 5, titulo: "Processo concluído", desc: "Caso Pereira - Trabalhista finalizado", tipo: "sucesso", tempo: "Ontem", lida: true },
];

const tipoIcon = {
  urgente: <AlertTriangle className="h-4 w-4 text-primary" />,
  aviso: <Clock className="h-4 w-4 text-warning" />,
  info: <CalendarDays className="h-4 w-4 text-muted-foreground" />,
  sucesso: <CheckCircle2 className="h-4 w-4 text-success" />,
};

export function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" className="relative" onClick={() => setOpen(!open)}>
        <Bell className="h-5 w-5 text-muted-foreground" />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">{naoLidas}</span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-elevated z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notificacoes.map((n) => (
                <div key={n.id} className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors ${!n.lida ? "bg-primary/5" : ""}`}>
                  <div className="mt-0.5">{tipoIcon[n.tipo as keyof typeof tipoIcon]}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.lida ? "font-medium text-foreground" : "text-muted-foreground"}`}>{n.titulo}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.desc}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{n.tempo}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-border">
              <button className="text-xs text-primary hover:underline w-full text-center">Ver todas as notificações</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
