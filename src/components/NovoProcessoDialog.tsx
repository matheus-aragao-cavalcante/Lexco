import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function NovoProcessoDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "", numero: "", cliente: "", partes: "", tribunal: "", vara: "", responsavel: "", status: "ativo", observacoes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.numero || !form.cliente) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    toast.success("Processo criado com sucesso!");
    setForm({ nome: "", numero: "", cliente: "", partes: "", tribunal: "", vara: "", responsavel: "", status: "ativo", observacoes: "" });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Processo</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Novo Processo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome / Descrição *" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} />
            <Field label="Número do Processo *" value={form.numero} onChange={(v) => setForm({ ...form, numero: v })} placeholder="0000000-00.0000.0.00.0000" />
            <Field label="Cliente *" value={form.cliente} onChange={(v) => setForm({ ...form, cliente: v })} />
            <Field label="Partes Envolvidas" value={form.partes} onChange={(v) => setForm({ ...form, partes: v })} />
            <Field label="Tribunal" value={form.tribunal} onChange={(v) => setForm({ ...form, tribunal: v })} />
            <Field label="Vara" value={form.vara} onChange={(v) => setForm({ ...form, vara: v })} />
            <Field label="Advogado Responsável" value={form.responsavel} onChange={(v) => setForm({ ...form, responsavel: v })} />
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="ativo">Ativo</option>
                <option value="pendente">Pendente</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Observações</label>
            <textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit">Criar Processo</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-muted-foreground">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}
