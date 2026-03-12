import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function NovoUsuarioDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "", email: "", cargo: "", perfil: "advogado", status: "ativo", observacoes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.email) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    toast.success("Usuário criado com sucesso!");
    setForm({ nome: "", email: "", cargo: "", perfil: "advogado", status: "ativo", observacoes: "" });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Usuário</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-heading">Novo Usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm text-muted-foreground">Nome *</label>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Email *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Cargo</label>
              <input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Perfil de Acesso</label>
              <select value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="admin">Admin</option>
                <option value="advogado">Advogado</option>
                <option value="colaborador">Colaborador</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Observações</label>
            <textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit">Criar Usuário</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
