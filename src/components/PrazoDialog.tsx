import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { db, addHistorico } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { PRIORIDADES, type Prazo, type Processo, type User } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prazo?: Prazo | null;          // se passado, modo edição
  processoId?: string;           // pré-vincular a um processo
  onSaved?: () => void;
}

/** Dialog reutilizável para criar/editar prazo. */
export function PrazoDialog({ open, onOpenChange, prazo, processoId, onSaved }: Props) {
  const { currentUser } = useAuth();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({
    titulo: "", descricao: "", processoId: processoId || "",
    responsavelId: "", dataLimite: "", hora: "",
    status: "pendente" as Prazo["status"], prioridade: "Normal", observacao: "",
  });

  useEffect(() => {
    if (!open) return;
    db.processos.toArray().then(setProcessos);
    db.users.toArray().then(setUsers);
    if (prazo) {
      setForm({
        titulo: prazo.titulo, descricao: prazo.descricao || "",
        processoId: prazo.processoId || "", responsavelId: prazo.responsavelId || "",
        dataLimite: prazo.dataLimite, hora: prazo.hora || "",
        status: prazo.status, prioridade: prazo.prioridade || "Normal",
        observacao: prazo.observacao || "",
      });
    } else {
      setForm({
        titulo: "", descricao: "", processoId: processoId || "",
        responsavelId: currentUser?.id || "", dataLimite: "", hora: "",
        status: "pendente", prioridade: "Normal", observacao: "",
      });
    }
  }, [open, prazo, processoId, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.dataLimite) {
      toast.error("Título e data limite são obrigatórios");
      return;
    }
    const now = new Date().toISOString();
    if (prazo) {
      const updated: Prazo = {
        ...prazo, ...form,
        atualizadoEm: now,
      };
      await db.prazos.put(updated);
      await addHistorico(prazo.id, "prazo", "edicao", `Prazo "${form.titulo}" editado`,
        currentUser?.id || "", currentUser?.nome || "");
      if (form.processoId) {
        await addHistorico(form.processoId, "processo", "prazo_editado",
          `Prazo "${form.titulo}" editado`, currentUser?.id || "", currentUser?.nome || "");
      }
      toast.success("Prazo atualizado!");
    } else {
      const id = crypto.randomUUID();
      await db.prazos.add({
        id, ...form,
        criadoPor: currentUser?.id || "", criadoEm: now, atualizadoEm: now,
      });
      await addHistorico(id, "prazo", "criacao", `Prazo "${form.titulo}" criado`,
        currentUser?.id || "", currentUser?.nome || "");
      if (form.processoId) {
        await addHistorico(form.processoId, "processo", "prazo_criado",
          `Prazo "${form.titulo}" criado`, currentUser?.id || "", currentUser?.nome || "");
      }
      toast.success("Prazo criado!");
    }
    onOpenChange(false);
    onSaved?.();
  };

  const inputCls = "w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{prazo ? "Editar Prazo" : "Novo Prazo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm text-muted-foreground">Título *</label>
              <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Data Limite *</label>
              <input type="date" value={form.dataLimite} onChange={(e) => setForm({ ...form, dataLimite: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Hora</label>
              <input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Processo Vinculado</label>
              <select value={form.processoId} onChange={(e) => setForm({ ...form, processoId: e.target.value })} className={inputCls} disabled={!!processoId}>
                <option value="">Sem processo</option>
                {processos.map((p) => <option key={p.id} value={p.id}>{p.titulo}{p.numero ? ` — ${p.numero}` : ""}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Responsável</label>
              <select value={form.responsavelId} onChange={(e) => setForm({ ...form, responsavelId: e.target.value })} className={inputCls}>
                <option value="">Selecionar</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Prioridade</label>
              <select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })} className={inputCls}>
                {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Prazo["status"] })} className={inputCls}>
                <option value="pendente">Pendente</option>
                <option value="urgente">Urgente</option>
                <option value="cumprido">Cumprido</option>
                <option value="atrasado">Atrasado</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Descrição</label>
            <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">{prazo ? "Salvar" : "Criar Prazo"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
