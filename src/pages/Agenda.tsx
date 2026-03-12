import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const eventos = [
  { dia: 12, titulo: "Audiência - Silva", hora: "09:00", tipo: "audiencia" },
  { dia: 12, titulo: "Prazo - Contestação", hora: "14:00", tipo: "prazo" },
  { dia: 13, titulo: "Reunião cliente ABC", hora: "10:00", tipo: "reuniao" },
  { dia: 13, titulo: "Prazo - Juntada", hora: "17:00", tipo: "prazo" },
  { dia: 15, titulo: "Audiência Conciliação", hora: "11:00", tipo: "audiencia" },
  { dia: 18, titulo: "Despacho Judicial", hora: "14:30", tipo: "audiencia" },
  { dia: 20, titulo: "Prazo - Recurso", hora: "23:59", tipo: "prazo" },
  { dia: 22, titulo: "Reunião equipe", hora: "09:00", tipo: "reuniao" },
  { dia: 25, titulo: "Audiência TRT", hora: "15:00", tipo: "audiencia" },
  { dia: 28, titulo: "Prazo - Parecer", hora: "17:00", tipo: "prazo" },
];

const tipoColors: Record<string, string> = {
  audiencia: "bg-primary/15 text-primary border-l-2 border-l-primary",
  prazo: "bg-warning/10 text-warning border-l-2 border-l-warning",
  reuniao: "bg-success/10 text-success border-l-2 border-l-success",
  compromisso: "bg-muted text-muted-foreground border-l-2 border-l-border",
};

const Agenda = () => {
  const [view, setView] = useState<"mes" | "semana" | "dia">("mes");
  const hoje = 12;

  // Generate calendar days for March 2026
  const diasNoMes = 31;
  const primeiroDia = 0; // Sunday
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1);
  const padding = Array.from({ length: primeiroDia }, (_, i) => null);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-foreground">Agenda</h1>
            <p className="text-muted-foreground text-sm mt-1">Março de 2026</p>
          </div>
          <div className="flex gap-3">
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {(["dia", "semana", "mes"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded text-sm transition-colors capitalize ${view === v ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
                >
                  {v === "mes" ? "Mês" : v === "semana" ? "Semana" : "Dia"}
                </button>
              ))}
            </div>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Novo Evento
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between bg-card rounded-lg border shadow-card p-3">
          <Button variant="ghost" size="icon"><ChevronLeft className="h-5 w-5" /></Button>
          <h2 className="font-heading font-semibold text-lg text-foreground">Março 2026</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">Hoje</Button>
            <Button variant="ghost" size="icon"><ChevronRight className="h-5 w-5" /></Button>
          </div>
        </div>

        {view === "mes" && (
          <div className="bg-card rounded-lg border shadow-card overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 bg-muted/50">
              {diasSemana.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {[...padding, ...dias].map((dia, i) => {
                const eventosdia = dia ? eventos.filter((e) => e.dia === dia) : [];
                const isHoje = dia === hoje;
                return (
                  <div
                    key={i}
                    className={`min-h-[100px] border-t border-r border-border p-1.5 ${!dia ? "bg-muted/20" : "hover:bg-muted/30 transition-colors"}`}
                  >
                    {dia && (
                      <>
                        <span className={`inline-flex items-center justify-center h-7 w-7 text-sm rounded-full ${
                          isHoje ? "bg-primary text-primary-foreground font-bold" : "text-foreground"
                        }`}>
                          {dia}
                        </span>
                        <div className="space-y-1 mt-1">
                          {eventosdia.slice(0, 2).map((e, j) => (
                            <div key={j} className={`text-[10px] px-1.5 py-0.5 rounded truncate ${tipoColors[e.tipo]}`}>
                              {e.hora} {e.titulo}
                            </div>
                          ))}
                          {eventosdia.length > 2 && (
                            <p className="text-[10px] text-muted-foreground px-1.5">+{eventosdia.length - 2} mais</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "semana" && (
          <div className="bg-card rounded-lg border shadow-card p-5">
            <div className="grid grid-cols-7 gap-3">
              {[9, 10, 11, 12, 13, 14, 15].map((dia) => {
                const eventosdia = eventos.filter((e) => e.dia === dia);
                const isHoje = dia === hoje;
                return (
                  <div key={dia} className={`rounded-lg p-3 min-h-[200px] ${isHoje ? "bg-primary/5 border border-primary/20" : "bg-muted/30"}`}>
                    <div className="text-center mb-3">
                      <p className="text-xs text-muted-foreground">{diasSemana[dia % 7]}</p>
                      <p className={`text-lg font-semibold ${isHoje ? "text-primary" : "text-foreground"}`}>{dia}</p>
                    </div>
                    <div className="space-y-2">
                      {eventosdia.map((e, j) => (
                        <div key={j} className={`text-xs p-2 rounded ${tipoColors[e.tipo]}`}>
                          <p className="font-medium">{e.hora}</p>
                          <p className="truncate">{e.titulo}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "dia" && (
          <div className="bg-card rounded-lg border shadow-card p-5">
            <h3 className="font-heading font-semibold text-foreground mb-4">12 de Março — Hoje</h3>
            <div className="space-y-1">
              {Array.from({ length: 12 }, (_, i) => i + 8).map((hora) => {
                const eventosHora = eventos.filter((e) => e.dia === 12 && parseInt(e.hora) === hora);
                return (
                  <div key={hora} className="flex gap-4 py-2 border-t border-border">
                    <span className="text-sm text-muted-foreground font-mono w-12 flex-shrink-0">{String(hora).padStart(2, "0")}:00</span>
                    <div className="flex-1 min-h-[40px]">
                      {eventosHora.map((e, j) => (
                        <div key={j} className={`text-sm p-2 rounded ${tipoColors[e.tipo]}`}>
                          <span className="font-medium">{e.titulo}</span>
                          <span className="ml-2 text-xs opacity-75">{e.hora}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Audiência</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-warning" /> Prazo</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Reunião</span>
        </div>
      </div>
    </AppLayout>
  );
};

export default Agenda;
