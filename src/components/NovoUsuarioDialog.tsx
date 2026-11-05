import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { dbProprio as db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import type { User } from "@/types";

export function NovoUsuarioDialog({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", cargo: "", perfil: "advogado", senha: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.email) { toast.error("Preencha nome e e-mail"); return; }
    // Senha é opcional: quem só acessa de outro computador (convite) não entra por aqui.
    if (form.senha && form.senha.length < 4) { toast.error("Senha deve ter no mínimo 4 caracteres"); return; }
    const existing = await db.users.where("email").equals(form.email.toLowerCase().trim()).first();
    if (existing) { toast.error("Email já cadastrado"); return; }
    const now = new Date().toISOString();
    await db.users.add({
      id: crypto.randomUUID(), nome: form.nome, email: form.email.toLowerCase().trim(),
      senha: form.senha ? await hashPassword(form.senha) : "", cargo: form.cargo, perfil: form.perfil as User["perfil"],
      status: "ativo", preferencias: { tema: "light", notifPrazo1Dia: true, notifPrazoHoje: true, notifAgenda: true, notifPendencias: true },
      criadoEm: now, atualizadoEm: now,
    });
    toast.success("Usuário cadastrado!");
    setForm({ nome: "", email: "", cargo: "", perfil: "advogado", senha: "" });
    setOpen(false);
    onSaved?.();
  };

  const inputCls = "w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Usuário</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader><DialogTitle className="font-heading">Novo Usuário</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm text-muted-foreground">Nome *</label>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Email (de preferência a conta Google) *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Senha (para entrar neste computador)</label>
              <input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} placeholder="Opcional — mín. 4 caracteres" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Cargo</label>
              <input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Perfil</label>
              <select value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })} className={inputCls}>
                <option value="admin">Admin</option>
                <option value="advogado">Advogado</option>
                <option value="colaborador">Colaborador</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Depois de cadastrar, use "Acessos" na lista para definir as permissões e, se quiser, convidar para acessar de outro computador.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit">Cadastrar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
