import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { db, addHistorico } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { TIPOS_EVENTO, TIPO_LABELS, MODALIDADES_EVENTO, PRIORIDADES, type Evento, type Processo, type User } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  evento?: Evento | null;
  processoId?: string;
  initialDate?: string;
  onSaved?: () => void;
}

const tipoLabels = TIPO_LABELS;

/** Dialog reutilizável para criar/editar evento. */
export function EventoDialog({ open, onOpenChange, evento, processoId, initialDate, onSaved }: Props) {
  const { currentUser } = useAuth();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({
    titulo: "", descricao: "", tipo: "audiencia", data: initialDate || "",
    horaInicio: "", horaFim: "", processoId: processoId || "",
    responsaveisIds: [] as string[], local: "", modalidade: "Presencial",
    linkReuniao: "", prioridade: "Normal", status: "pendente" as Evento["status"],
    observacoes: "",
  });

  useEffect(() => {
    if (!open) return;
    db.processos.toArray().then(setProcessos);
    db.users.toArray().then(setUsers);
    if (evento) {
      setForm({
        titulo: evento.titulo, descricao: evento.descricao || "",
        tipo: evento.tipo, data: evento.data,
        horaInicio: evento.horaInicio || "", horaFim: evento.horaFim || "",
        processoId: evento.processoId || "",
        responsaveisIds: evento.responsaveisIds || [],
        local: evento.local || "", modalidade: evento.modalidade || "Presencial",
        linkReuniao: evento.linkReuniao || "", prioridade: evento.prioridade || "Normal",
        status: evento.status, observacoes: evento.observacoes || "",
      });
    } else {
      setForm({
        titulo: "", descricao: "", tipo: "audiencia", data: initialDate || "",
        horaInicio: "", horaFim: "", processoId: processoId || "",
        responsaveisIds: currentUser ? [currentUser.id] : [],
        local: "", modalidade: "Presencial", linkReuniao: "",
        prioridade: "Normal", status: "pendente", observacoes: "",
      });
    }
  }, [open, evento, processoId, initialDate, currentUser]);

  /** Quem concluiu e quando (mesmo comportamento do formulário de tarefa). */
  const conclusao = (status: Evento["status"], anterior?: Evento) =>
    status !== "concluido"
      ? { concluidoEm: undefined, concluidoPor: undefined }
      : anterior?.status === "concluido"
        ? {}
        : { concluidoEm: new Date().toISOString(), concluidoPor: currentUser?.id || "" };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.data) {
      toast.error("Título e data são obrigatórios");
      return;
    }
    const now = new Date().toISOString();
    if (evento) {
      const updated: Evento = {
        ...evento, ...form,
        partesIds: evento.partesIds || [],
        atualizadoEm: now,
        ...conclusao(form.status, evento),
      };
      await db.eventos.put(updated);
      await addHistorico(evento.id, "evento", "edicao", `Evento "${form.titulo}" editado`,
        currentUser?.id || "", currentUser?.nome || "");
      if (form.processoId) {
        await addHistorico(form.processoId, "processo", "evento_editado",
          `Evento "${form.titulo}" editado`, currentUser?.id || "", currentUser?.nome || "");
      }
      toast.success("Evento atualizado!");
    } else {
      const id = crypto.randomUUID();
      await db.eventos.add({
        id, ...form, partesIds: [],
        criadoPor: currentUser?.id || "", criadoEm: now, atualizadoEm: now,
        ...conclusao(form.status),
      });
      await addHistorico(id, "evento", "criacao", `Evento "${form.titulo}" criado`,
        currentUser?.id || "", currentUser?.nome || "");
      if (form.processoId) {
        await addHistorico(form.processoId, "processo", "evento_criado",
          `Evento "${form.titulo}" criado`, currentUser?.id || "", currentUser?.nome || "");
      }
      toast.success("Evento criado!");
    }
    onOpenChange(false);
    onSaved?.();
  };

  const inputCls = "w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{evento ? "Editar Evento" : "Novo Evento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm text-muted-foreground">Título *</label>
              <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={inputCls}>
                {TIPOS_EVENTO.map((t) => <option key={t} value={t}>{tipoLabels[t] || t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Data *</label>
              <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Hora Início</label>
              <input type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Hora Fim</label>
              <input type="time" value={form.horaFim} onChange={(e) => setForm({ ...form, horaFim: e.target.value })} className={inputCls} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm text-muted-foreground">Processo Vinculado</label>
              <select value={form.processoId} onChange={(e) => setForm({ ...form, processoId: e.target.value })} className={inputCls} disabled={!!processoId}>
                <option value="">Sem processo</option>
                {processos.map((p) => <option key={p.id} value={p.id}>{p.titulo}{p.numero ? ` — ${p.numero}` : ""}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Local</label>
              <input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Modalidade</label>
              <select value={form.modalidade} onChange={(e) => setForm({ ...form, modalidade: e.target.value })} className={inputCls}>
                {MODALIDADES_EVENTO.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {form.modalidade !== "Presencial" && (
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-sm text-muted-foreground">Link da Reunião</label>
                <input value={form.linkReuniao} onChange={(e) => setForm({ ...form, linkReuniao: e.target.value })} className={inputCls} />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Prioridade</label>
              <select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })} className={inputCls}>
                {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Evento["status"] })} className={inputCls}>
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm text-muted-foreground">Responsáveis</label>
              <select multiple value={form.responsaveisIds} onChange={(e) => setForm({ ...form, responsaveisIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
                className="w-full min-h-[80px] px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                {users.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Observações</label>
            <textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">{evento ? "Salvar" : "Criar Evento"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
