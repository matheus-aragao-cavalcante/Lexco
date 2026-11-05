import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { PRIORIDADES, STATUS_TAREFA, STATUS_TAREFA_LABELS, type Evento, type Processo, type User } from "@/types";
import { criarTarefa, atualizarTarefa, type DadosTarefa } from "@/lib/tarefas";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tarefa?: Evento | null;
  /** Pré-vincula a um processo (e trava o campo). */
  processoId?: string;
  initialDate?: string;
  onSaved?: () => void;
}

const vazio = (data: string, processoId: string, responsavel?: string): DadosTarefa => ({
  titulo: "", descricao: "", data, horaInicio: "", processoId,
  responsaveisIds: responsavel ? [responsavel] : [],
  prioridade: "Normal", status: "pendente", observacoes: "",
});

/** Fluxo próprio de tarefa: só os campos que importam (o que, quem, até quando, status). */
export function TarefaDialog({ open, onOpenChange, tarefa, processoId, initialDate, onSaved }: Props) {
  const { currentUser } = useAuth();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<DadosTarefa>(vazio("", ""));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    db.processos.toArray().then((ps) => setProcessos(ps.sort((a, b) => a.titulo.localeCompare(b.titulo))));
    db.users.where("status").equals("ativo").toArray().then(setUsers);
    if (tarefa) {
      setForm({
        titulo: tarefa.titulo, descricao: tarefa.descricao || "", data: tarefa.data,
        horaInicio: tarefa.horaInicio || "", processoId: tarefa.processoId || "",
        responsaveisIds: tarefa.responsaveisIds || [], prioridade: tarefa.prioridade || "Normal",
        status: tarefa.status, observacoes: tarefa.observacoes || "",
      });
    } else {
      setForm(vazio(initialDate || "", processoId || "", currentUser?.id));
    }
  }, [open, tarefa, processoId, initialDate, currentUser]);

  const set = <K extends keyof DadosTarefa>(k: K, v: DadosTarefa[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleResp = (id: string) =>
    set("responsaveisIds", form.responsaveisIds.includes(id) ? form.responsaveisIds.filter((x) => x !== id) : [...form.responsaveisIds, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) { toast.error("Descreva a tarefa"); return; }
    if (!form.data) { toast.error("Informe o prazo da tarefa"); return; }
    if (!currentUser) return;
    const autor = { id: currentUser.id, nome: currentUser.nome };
    setSalvando(true);
    try {
      if (tarefa) {
        await atualizarTarefa(tarefa, { ...form, titulo: form.titulo.trim() }, autor);
        toast.success("Tarefa atualizada!");
      } else {
        await criarTarefa({ ...form, titulo: form.titulo.trim() }, autor);
        toast.success("Tarefa criada!");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a tarefa");
    } finally {
      setSalvando(false);
    }
  };

  const inputCls = "w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{tarefa ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">O que precisa ser feito? *</label>
            <input autoFocus value={form.titulo} onChange={(e) => set("titulo", e.target.value)} className={inputCls}
              placeholder="Ex.: Protocolar manifestação" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Status</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {STATUS_TAREFA.map((st) => (
                <button key={st} type="button" onClick={() => set("status", st)} aria-pressed={form.status === st}
                  className={cn("h-8 rounded-lg border text-xs transition-colors",
                    form.status === st ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
                  {STATUS_TAREFA_LABELS[st]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Prazo *</label>
              <input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Hora (opcional)</label>
              <input type="time" value={form.horaInicio} onChange={(e) => set("horaInicio", e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Prioridade</label>
              <select value={form.prioridade} onChange={(e) => set("prioridade", e.target.value)} className={inputCls}>
                {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Processo vinculado</label>
            <select value={form.processoId} onChange={(e) => set("processoId", e.target.value)} className={inputCls} disabled={!!processoId}>
              <option value="">Sem processo</option>
              {processos.map((p) => <option key={p.id} value={p.id}>{p.titulo}{p.numero ? ` — ${p.numero}` : ""}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Responsáveis</label>
            <div className="flex flex-wrap gap-1.5">
              {users.map((u) => {
                const sel = form.responsaveisIds.includes(u.id);
                return (
                  <button key={u.id} type="button" onClick={() => toggleResp(u.id)} aria-pressed={sel}
                    className={cn("px-2.5 py-1 rounded-full border text-xs transition-colors",
                      sel ? "border-primary bg-primary/10 text-primary font-medium" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
                    {u.nome}{u.id === currentUser?.id ? " (eu)" : ""}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Detalhes</label>
            <textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>

          {tarefa?.concluidoEm && (
            <p className="text-xs text-muted-foreground">
              Concluída em {new Date(tarefa.concluidoEm).toLocaleString("pt-BR")}
              {tarefa.concluidoPor && users.find((u) => u.id === tarefa.concluidoPor) ? ` por ${users.find((u) => u.id === tarefa.concluidoPor)!.nome}` : ""}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={salvando}>{tarefa ? "Salvar" : "Criar Tarefa"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
