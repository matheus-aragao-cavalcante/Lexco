import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db, addHistorico } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { EventoDialog } from "@/components/EventoDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Evento, Processo } from "@/types";
import { formatarData, hojeISO, toISODateLocal } from "@/lib/dates";
import { toast } from "sonner";

const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const tipoColors: Record<string, string> = {
  audiencia: "bg-primary/15 text-primary border-l-2 border-l-primary",
  prazo: "bg-warning/10 text-warning border-l-2 border-l-warning",
  reuniao: "bg-success/10 text-success border-l-2 border-l-success",
  sustentacao_oral: "bg-primary/15 text-primary border-l-2 border-l-primary",
  diligencia: "bg-muted text-muted-foreground border-l-2 border-l-border",
  protocolo: "bg-muted text-muted-foreground border-l-2 border-l-border",
  atendimento: "bg-success/10 text-success border-l-2 border-l-success",
  despacho: "bg-warning/10 text-warning border-l-2 border-l-warning",
  sessao: "bg-primary/15 text-primary border-l-2 border-l-primary",
  compromisso: "bg-muted text-muted-foreground border-l-2 border-l-border",
  outro: "bg-muted text-muted-foreground border-l-2 border-l-border",
};

const Agenda = () => {
  const { currentUser } = useAuth();
  const [view, setView] = useState<"mes" | "semana" | "dia">("mes");
  // Data selecionada: base para as visões de mês, semana e dia.
  const [cursor, setCursor] = useState(() => new Date());
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [processos, setProcessos] = useState<Record<string, Processo>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Evento | null>(null);
  const [initialDate, setInitialDate] = useState<string>("");
  const [confirmDel, setConfirmDel] = useState<Evento | null>(null);

  const load = async () => {
    const [evs, procs] = await Promise.all([db.eventos.toArray(), db.processos.toArray()]);
    setEventos(evs);
    setProcessos(Object.fromEntries(procs.map((p) => [p.id, p])));
  };
  useEffect(() => { load(); }, []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const todayDay = today.getDate();
  const todayISO = hojeISO();
  const cursorISO = toISODateLocal(cursor);

  const monthName = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  // Semana (domingo a sábado) que contém a data selecionada — pode atravessar meses.
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => new Date(year, month, cursor.getDate() - cursor.getDay() + i));
  const tituloPeriodo =
    view === "mes"
      ? monthName
      : view === "semana"
        ? `${formatarData(toISODateLocal(diasDaSemana[0]))} – ${formatarData(toISODateLocal(diasDaSemana[6]))}`
        : cursor.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const diasNoMes = new Date(year, month + 1, 0).getDate();
  const primeiroDia = new Date(year, month, 1).getDay();
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1);
  const padding = Array.from({ length: primeiroDia }, () => null);

  const eventosPorDia = useMemo(() => {
    const map: Record<number, Evento[]> = {};
    eventos.forEach((e) => {
      const [y, m, d] = e.data.split("-").map(Number);
      if (y === year && m - 1 === month) {
        map[d] = map[d] || [];
        map[d].push(e);
      }
    });
    return map;
  }, [eventos, year, month]);

  const handleNewAt = (dia: number) => {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    setEditing(null); setInitialDate(iso); setDialogOpen(true);
  };
  const handleEdit = (e: Evento) => { setEditing(e); setInitialDate(""); setDialogOpen(true); };

  const handleDelete = async () => {
    if (!confirmDel) return;
    await db.eventos.delete(confirmDel.id);
    await addHistorico(confirmDel.id, "evento", "exclusao",
      `Evento "${confirmDel.titulo}" excluído`, currentUser?.id || "", currentUser?.nome || "");
    if (confirmDel.processoId) {
      await addHistorico(confirmDel.processoId, "processo", "evento_excluido",
        `Evento "${confirmDel.titulo}" excluído`, currentUser?.id || "", currentUser?.nome || "");
    }
    toast.success("Evento excluído");
    setConfirmDel(null);
    load();
  };

  const passo = (dir: 1 | -1) => {
    if (view === "mes") setCursor(new Date(year, month + dir, 1));
    else setCursor(new Date(year, month, cursor.getDate() + dir * (view === "semana" ? 7 : 1)));
  };
  const goPrev = () => passo(-1);
  const goNext = () => passo(1);
  const goToday = () => setCursor(new Date());

  const porHora = (a: Evento, b: Evento) => (a.horaInicio || "").localeCompare(b.horaInicio || "");
  const eventosDoDiaSelecionado = (dia: number) => eventosPorDia[dia] || [];
  const eventosNaData = (iso: string) => eventos.filter((e) => e.data === iso).sort(porHora);
  const eventosDoDia = eventosNaData(cursorISO);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-foreground">Agenda</h1>
            <p className="text-muted-foreground text-sm mt-1 first-letter:uppercase">{tituloPeriodo}</p>
          </div>
          <div className="flex gap-3">
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {(["dia", "semana", "mes"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded text-sm transition-colors capitalize ${view === v ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                  {v === "mes" ? "Mês" : v === "semana" ? "Semana" : "Dia"}
                </button>
              ))}
            </div>
            <Button className="gap-2" onClick={() => { setEditing(null); setInitialDate(view === "mes" ? todayISO : cursorISO); setDialogOpen(true); }}>
              <Plus className="h-4 w-4" /> Novo Evento
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between bg-card rounded-lg border shadow-card p-3">
          <Button variant="ghost" size="icon" onClick={goPrev}><ChevronLeft className="h-5 w-5" /></Button>
          <h2 className="font-heading font-semibold text-lg text-foreground first-letter:uppercase">{tituloPeriodo}</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={goToday}>Hoje</Button>
            <Button variant="ghost" size="icon" onClick={goNext}><ChevronRight className="h-5 w-5" /></Button>
          </div>
        </div>

        {view === "mes" && (
          <div className="bg-card rounded-lg border shadow-card overflow-hidden">
            <div className="grid grid-cols-7 bg-muted/50">
              {diasSemana.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {[...padding, ...dias].map((dia, i) => {
                const evs = dia ? eventosDoDiaSelecionado(dia) : [];
                const isHoje = isCurrentMonth && dia === todayDay;
                return (
                  <div key={i} onClick={() => dia && handleNewAt(dia)}
                    className={`min-h-[100px] border-t border-r border-border p-1.5 ${!dia ? "bg-muted/20" : "hover:bg-muted/30 transition-colors cursor-pointer"}`}>
                    {dia && (
                      <>
                        <span className={`inline-flex items-center justify-center h-7 w-7 text-sm rounded-full ${
                          isHoje ? "bg-primary text-primary-foreground font-bold" : "text-foreground"
                        }`}>{dia}</span>
                        <div className="space-y-1 mt-1">
                          {evs.slice(0, 2).map((e) => (
                            <button key={e.id} onClick={(ev) => { ev.stopPropagation(); handleEdit(e); }}
                              className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate ${tipoColors[e.tipo] || tipoColors.outro}`}>
                              {e.horaInicio || ""} {e.titulo}
                            </button>
                          ))}
                          {evs.length > 2 && (
                            <p className="text-[10px] text-muted-foreground px-1.5">+{evs.length - 2} mais</p>
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
              {diasDaSemana.map((dt) => {
                const iso = toISODateLocal(dt);
                const evs = eventosNaData(iso);
                const isHoje = iso === todayISO;
                return (
                  <div key={iso} className={`rounded-lg p-3 min-h-[200px] ${isHoje ? "bg-primary/5 border border-primary/20" : "bg-muted/30"}`}>
                    <button
                      type="button"
                      onClick={() => { setCursor(dt); setView("dia"); }}
                      className="w-full text-center mb-3 rounded hover:bg-muted/60 transition-colors"
                      title="Ver o dia"
                    >
                      <p className="text-xs text-muted-foreground">{diasSemana[dt.getDay()]}</p>
                      <p className={`text-lg font-semibold ${isHoje ? "text-primary" : "text-foreground"}`}>{dt.getDate()}</p>
                    </button>
                    <div className="space-y-2">
                      {evs.map((e) => (
                        <button key={e.id} onClick={() => handleEdit(e)}
                          className={`w-full text-left text-xs p-2 rounded ${tipoColors[e.tipo] || tipoColors.outro}`}>
                          <p className="font-medium">{e.horaInicio || ""}</p>
                          <p className="truncate">{e.titulo}</p>
                        </button>
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
            <h3 className="font-heading font-semibold text-foreground mb-4 first-letter:uppercase">
              {tituloPeriodo}{cursorISO === todayISO ? " — Hoje" : ""}
            </h3>
            <div className="space-y-2">
              {eventosDoDia.map((e) => {
                const proc = e.processoId ? processos[e.processoId] : null;
                return (
                  <div key={e.id} className={`flex items-start justify-between gap-3 p-3 rounded-lg ${tipoColors[e.tipo] || tipoColors.outro}`}>
                    <div className="flex-1 min-w-0">
                      <button onClick={() => handleEdit(e)} className="font-medium text-left hover:underline">{e.titulo}</button>
                      <p className="text-xs opacity-80 mt-0.5">
                        {e.horaInicio ? e.horaInicio : "Dia todo"}
                        {proc && <> · <Link to={`/processos/${proc.id}`} className="underline hover:opacity-100">{proc.numero || proc.titulo}</Link></>}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDel(e)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                );
              })}
              {eventosDoDia.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">Nenhum evento neste dia.</p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Audiência/Sessão</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-warning" /> Prazo/Despacho</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Reunião/Atendimento</span>
        </div>
      </div>

      <EventoDialog open={dialogOpen} onOpenChange={setDialogOpen} evento={editing} initialDate={initialDate} onSaved={load} />
      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(v) => !v && setConfirmDel(null)}
        title="Excluir evento?"
        description={confirmDel ? `O evento "${confirmDel.titulo}" será removido permanentemente.` : ""}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
    </AppLayout>
  );
};

export default Agenda;
