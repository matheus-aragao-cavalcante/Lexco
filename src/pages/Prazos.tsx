import { AppLayout } from "@/components/AppLayout";
import { KPICard } from "@/components/KPICard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, CheckCircle2, CalendarDays, List, Timer, Plus, Pencil, Trash2, CheckCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db, addHistorico } from "@/lib/db";
import { formatarData, hojeISO, somarDiasISO, statusEfetivoPrazo } from "@/lib/dates";
import { useAuth } from "@/contexts/AuthContext";
import { PrazoDialog } from "@/components/PrazoDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Prazo, Processo, User } from "@/types";
import { toast } from "sonner";

const Prazos = () => {
  const { currentUser, permissoes } = useAuth();
  const [view, setView] = useState<"lista" | "timeline">("lista");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [prazos, setPrazos] = useState<Prazo[]>([]);
  const [processos, setProcessos] = useState<Record<string, Processo>>({});
  const [users, setUsers] = useState<Record<string, User>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Prazo | null>(null);
  const [confirmDel, setConfirmDel] = useState<Prazo | null>(null);

  const load = async () => {
    const [ps, procs, us] = await Promise.all([
      db.prazos.toArray(), db.processos.toArray(), db.users.toArray(),
    ]);
    setPrazos(ps.sort((a, b) => a.dataLimite.localeCompare(b.dataLimite)));
    setProcessos(Object.fromEntries(procs.map((p) => [p.id, p])));
    setUsers(Object.fromEntries(us.map((u) => [u.id, u])));
  };
  useEffect(() => { load(); }, []);

  const today = hojeISO();
  const in7 = somarDiasISO(today, 7);
  const tomorrow = somarDiasISO(today, 1);

  const kpis = useMemo(() => ({
    hoje: prazos.filter((p) => p.dataLimite === today && p.status !== "cumprido").length,
    amanha: prazos.filter((p) => p.dataLimite === tomorrow && p.status !== "cumprido").length,
    semana: prazos.filter((p) => p.dataLimite >= today && p.dataLimite <= in7 && p.status !== "cumprido").length,
    atrasados: prazos.filter((p) => p.dataLimite < today && p.status !== "cumprido").length,
    cumpridos: prazos.filter((p) => p.status === "cumprido").length,
  }), [prazos, today, tomorrow, in7]);

  // Filtra pelo status efetivo: um prazo pendente com data passada aparece em "Atrasados".
  const filtered = prazos.filter((p) => statusFilter === "todos" || statusEfetivoPrazo(p, today) === statusFilter);

  const handleEdit = (p: Prazo) => { setEditing(p); setDialogOpen(true); };
  const handleNew = () => { setEditing(null); setDialogOpen(true); };

  const handleConcluir = async (p: Prazo) => {
    await db.prazos.put({ ...p, status: "cumprido", atualizadoEm: new Date().toISOString() });
    await addHistorico(p.id, "prazo", "concluido", `Prazo "${p.titulo}" marcado como cumprido`,
      currentUser?.id || "", currentUser?.nome || "");
    if (p.processoId) {
      await addHistorico(p.processoId, "processo", "prazo_concluido",
        `Prazo "${p.titulo}" marcado como cumprido`, currentUser?.id || "", currentUser?.nome || "");
    }
    toast.success("Prazo cumprido!");
    load();
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    await db.prazos.delete(confirmDel.id);
    await addHistorico(confirmDel.id, "prazo", "exclusao",
      `Prazo "${confirmDel.titulo}" excluído`, currentUser?.id || "", currentUser?.nome || "");
    if (confirmDel.processoId) {
      await addHistorico(confirmDel.processoId, "processo", "prazo_excluido",
        `Prazo "${confirmDel.titulo}" excluído`, currentUser?.id || "", currentUser?.nome || "");
    }
    toast.success("Prazo excluído");
    setConfirmDel(null);
    load();
  };

  const formatDate = formatarData;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-foreground">Prazos</h1>
            <p className="text-muted-foreground text-sm mt-1">Controle de prazos jurídicos</p>
          </div>
          {permissoes.editarProcessos && <Button className="gap-2" onClick={handleNew}><Plus className="h-4 w-4" /> Novo Prazo</Button>}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard title="Hoje" value={kpis.hoje} icon={Clock} variant="warning" />
          <KPICard title="Amanhã" value={kpis.amanha} icon={CalendarDays} variant="primary" />
          <KPICard title="Esta Semana" value={kpis.semana} icon={Timer} variant="default" />
          <KPICard title="Atrasados" value={kpis.atrasados} icon={AlertTriangle} variant="destructive" />
          <KPICard title="Cumpridos" value={kpis.cumpridos} icon={CheckCircle2} variant="success" />
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <div className="flex gap-2 flex-wrap">
            {[
              { key: "todos", label: "Todos" },
              { key: "urgente", label: "Urgentes" },
              { key: "pendente", label: "Pendentes" },
              { key: "atrasado", label: "Atrasados" },
              { key: "cumprido", label: "Cumpridos" },
            ].map((s) => (
              <button key={s.key} onClick={() => setStatusFilter(s.key)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  statusFilter === s.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/30"
                }`}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button onClick={() => setView("lista")} className={`px-3 py-1 rounded text-sm transition-colors ${view === "lista" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setView("timeline")} className={`px-3 py-1 rounded text-sm transition-colors ${view === "timeline" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <Timer className="h-4 w-4" />
            </button>
          </div>
        </div>

        {view === "lista" ? (
          <div className="bg-card rounded-lg border shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Prazo</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden md:table-cell">Processo</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden lg:table-cell">Responsável</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data Limite</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const proc = p.processoId ? processos[p.processoId] : null;
                    const resp = p.responsavelId ? users[p.responsavelId] : null;
                    return (
                      <tr key={p.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <button onClick={() => handleEdit(p)} className="font-medium text-foreground hover:text-primary text-left">
                            {p.titulo}
                          </button>
                          {proc && <p className="text-xs text-muted-foreground md:hidden">{proc.numero || proc.titulo}</p>}
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          {proc ? (
                            <Link to={`/processos/${proc.id}`} className="text-primary hover:underline font-mono text-xs">
                              {proc.numero || proc.titulo}
                            </Link>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="py-3 px-4 text-foreground hidden lg:table-cell">{resp?.nome || "—"}</td>
                        <td className="py-3 px-4 text-foreground font-medium">{formatDate(p.dataLimite)}{p.hora ? ` ${p.hora}` : ""}</td>
                        <td className="py-3 px-4"><StatusBadge status={statusEfetivoPrazo(p, today)} /></td>
                        <td className="py-3 px-4">
                          {permissoes.editarProcessos && <div className="flex justify-end gap-1">
                            {p.status !== "cumprido" && (
                              <Button size="icon" variant="ghost" onClick={() => handleConcluir(p)} title="Marcar como cumprido">
                                <CheckCheck className="h-4 w-4 text-success" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(p)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setConfirmDel(p)} title="Excluir">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                      Nenhum prazo encontrado. Clique em "Novo Prazo" para começar.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-lg border shadow-card p-6">
            <div className="relative">
              {filtered.length > 0 && <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />}
              <div className="space-y-6">
                {filtered.map((p) => {
                  const proc = p.processoId ? processos[p.processoId] : null;
                  return (
                    <div key={p.id} className="relative pl-10">
                      <div className={`absolute left-2.5 top-1.5 h-3 w-3 rounded-full border-2 ${
                        statusEfetivoPrazo(p, today) === "urgente" ? "bg-primary border-primary" :
                        statusEfetivoPrazo(p, today) === "atrasado" ? "bg-destructive border-destructive" :
                        statusEfetivoPrazo(p, today) === "cumprido" ? "bg-success border-success" :
                        "bg-warning border-warning"
                      }`} />
                      <div className="p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <button onClick={() => handleEdit(p)} className="font-medium text-foreground hover:text-primary text-left">
                              {p.titulo}
                            </button>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {proc && <Link to={`/processos/${proc.id}`} className="text-primary hover:underline">{proc.numero || proc.titulo}</Link>}
                              {proc && " · "}{users[p.responsavelId || ""]?.nome || ""}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                            <StatusBadge status={statusEfetivoPrazo(p, today)} />
                            <p className="text-xs text-muted-foreground">{formatDate(p.dataLimite)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">Nenhum prazo encontrado.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <PrazoDialog open={dialogOpen} onOpenChange={setDialogOpen} prazo={editing} onSaved={load} />
      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(v) => !v && setConfirmDel(null)}
        title="Excluir prazo?"
        description={confirmDel ? `O prazo "${confirmDel.titulo}" será removido permanentemente.` : ""}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
    </AppLayout>
  );
};

export default Prazos;
