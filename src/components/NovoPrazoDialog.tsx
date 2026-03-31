import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { db, addHistorico } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";

export function NovoPrazoDialog({ processoId, onSaved }: { processoId?: string; onSaved?: () => void } = {}) {
  const [open, setOpen] = useState(false);
  const { currentUser } = useAuth();
  const [form, setForm] = useState({
    titulo: "", descricao: "", processo: processoId || "", responsavel: "", dataLimite: "", hora: "", status: "pendente", observacao: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo || !form.dataLimite) { toast.error("Preencha os campos obrigatórios"); return; }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.prazos.add({
      id, titulo: form.titulo, descricao: form.descricao, processoId: form.processo || processoId,
      responsavelId: form.responsavel || currentUser?.id, dataLimite: form.dataLimite, hora: form.hora,
      status: "pendente", prioridade: "Normal", observacao: form.observacao,
      criadoPor: currentUser?.id || "", criadoEm: now, atualizadoEm: now,
    });
    await addHistorico(id, "prazo", "criacao", `Prazo "${form.titulo}" criado`, currentUser?.id || "", currentUser?.nome || "");
    toast.success("Prazo criado com sucesso!");
    setForm({ titulo: "", descricao: "", processo: processoId || "", responsavel: "", dataLimite: "", hora: "", status: "pendente", observacao: "" });
    setOpen(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Prazo</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-heading">Novo Prazo</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm text-muted-foreground">Título *</label>
              <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Data Limite *</label>
              <input type="date" value={form.dataLimite} onChange={(e) => setForm({ ...form, dataLimite: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Hora (opcional)</label>
              <input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Descrição</label>
            <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit">Criar Prazo</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
