import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { db, addHistorico } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { TIPOS_EVENTO, MODALIDADES_EVENTO } from "@/types";

export function NovoEventoDialog({ onSaved }: { onSaved?: () => void } = {}) {
  const [open, setOpen] = useState(false);
  const { currentUser } = useAuth();
  const [form, setForm] = useState({
    titulo: "", descricao: "", tipo: "audiencia", data: "", horaInicio: "", horaFim: "",
    processo: "", responsavel: "", local: "", modalidade: "Presencial", linkReuniao: "", observacoes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo || !form.data) { toast.error("Preencha os campos obrigatórios"); return; }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.eventos.add({
      id, titulo: form.titulo, descricao: form.descricao, tipo: form.tipo, data: form.data,
      horaInicio: form.horaInicio, horaFim: form.horaFim, processoId: form.processo || undefined,
      partesIds: [], responsaveisIds: currentUser ? [currentUser.id] : [],
      local: form.local, modalidade: form.modalidade, linkReuniao: form.linkReuniao,
      status: "pendente", observacoes: form.observacoes,
      criadoPor: currentUser?.id || "", criadoEm: now, atualizadoEm: now,
    });
    await addHistorico(id, "evento", "criacao", `Evento "${form.titulo}" criado`, currentUser?.id || "", currentUser?.nome || "");
    toast.success("Evento criado com sucesso!");
    setForm({ titulo: "", descricao: "", tipo: "audiencia", data: "", horaInicio: "", horaFim: "", processo: "", responsavel: "", local: "", modalidade: "Presencial", linkReuniao: "", observacoes: "" });
    setOpen(false);
    onSaved?.();
  };

  const inputCls = "w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
  const tipoLabels: Record<string, string> = {
    audiencia: "Audiência", prazo: "Prazo", reuniao: "Reunião", sustentacao_oral: "Sustentação Oral",
    diligencia: "Diligência", protocolo: "Protocolo", atendimento: "Atendimento", despacho: "Despacho",
    sessao: "Sessão", compromisso: "Compromisso", outro: "Outro",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Evento</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-heading">Novo Evento</DialogTitle></DialogHeader>
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
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Link da Reunião</label>
                <input value={form.linkReuniao} onChange={(e) => setForm({ ...form, linkReuniao: e.target.value })} className={inputCls} />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Observações</label>
            <textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit">Criar Evento</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
