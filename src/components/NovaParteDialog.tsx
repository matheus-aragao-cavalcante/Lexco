import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { db, addHistorico } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { ESTADOS_CIVIS, TIPOS_PESSOA, UFS_BRASIL } from "@/types";

interface Props { onSaved?: () => void; triggerLabel?: string; }

export function NovaParteDialog({ onSaved, triggerLabel }: Props) {
  const [open, setOpen] = useState(false);
  const { currentUser } = useAuth();
  const [tipoPessoa, setTipoPessoa] = useState("Pessoa Física");
  const [form, setForm] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = tipoPessoa === "Pessoa Física" ? form.nome : (form.razaoSocial || form.nome);
    if (!nome) { toast.error("Preencha o nome"); return; }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await db.partes.add({
      id,
      tipoPessoa,
      nome: form.nome || "",
      nomeSocial: form.nomeSocial,
      razaoSocial: form.razaoSocial,
      nomeFantasia: form.nomeFantasia,
      cpfCnpj: form.cpfCnpj,
      rg: form.rg,
      orgaoEmissor: form.orgaoEmissor,
      inscricaoEstadual: form.inscricaoEstadual,
      inscricaoMunicipal: form.inscricaoMunicipal,
      dataNascimento: form.dataNascimento,
      nacionalidade: form.nacionalidade,
      naturalidade: form.naturalidade,
      estadoCivil: form.estadoCivil,
      profissao: form.profissao,
      genero: form.genero,
      telefone: form.telefone,
      telefone2: form.telefone2,
      email: form.email,
      endereco: form.endereco,
      cep: form.cep,
      cidade: form.cidade,
      estado: form.estado,
      representanteLegal: form.representanteLegal,
      advogadoVinculado: form.advogadoVinculado,
      qualificacao: form.qualificacao,
      dadosComplementares: form.dadosComplementares,
      observacoes: form.observacoes,
      status: "ativo",
      criadoPor: currentUser?.id || "",
      criadoEm: now,
      atualizadoEm: now,
    });
    await addHistorico(id, "parte", "criacao", `Parte "${nome}" cadastrada`, currentUser?.id || "", currentUser?.nome || "");
    toast.success("Parte cadastrada com sucesso!");
    setForm({});
    setTipoPessoa("Pessoa Física");
    setOpen(false);
    onSaved?.();
  };

  const inputCls = "w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
  const labelCls = "text-sm text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> {triggerLabel || "Nova Parte"}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Nova Parte Interessada</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Tipo de pessoa */}
          <div className="space-y-1.5">
            <label className={labelCls}>Tipo de Pessoa *</label>
            <div className="flex gap-2 flex-wrap">
              {TIPOS_PESSOA.map((t) => (
                <button key={t} type="button" onClick={() => setTipoPessoa(t)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${tipoPessoa === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"}`}
                >{t}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tipoPessoa === "Pessoa Física" ? (
              <>
                <F label="Nome Completo *" k="nome" form={form} set={set} />
                <F label="Nome Social" k="nomeSocial" form={form} set={set} />
                <F label="CPF" k="cpfCnpj" form={form} set={set} placeholder="000.000.000-00" />
                <F label="RG" k="rg" form={form} set={set} />
                <F label="Órgão Emissor" k="orgaoEmissor" form={form} set={set} />
                <F label="Data de Nascimento" k="dataNascimento" form={form} set={set} type="date" />
                <F label="Nacionalidade" k="nacionalidade" form={form} set={set} />
                <F label="Naturalidade" k="naturalidade" form={form} set={set} />
                <div className="space-y-1.5">
                  <label className={labelCls}>Estado Civil</label>
                  <select value={form.estadoCivil || ""} onChange={(e) => set("estadoCivil", e.target.value)} className={inputCls}>
                    <option value="">Selecionar</option>
                    {ESTADOS_CIVIS.map((ec) => <option key={ec} value={ec}>{ec}</option>)}
                  </select>
                </div>
                <F label="Profissão" k="profissao" form={form} set={set} />
                <F label="Gênero" k="genero" form={form} set={set} />
              </>
            ) : (
              <>
                <F label="Razão Social *" k="razaoSocial" form={form} set={set} />
                <F label="Nome Fantasia" k="nomeFantasia" form={form} set={set} />
                <F label="CNPJ" k="cpfCnpj" form={form} set={set} placeholder="00.000.000/0000-00" />
                <F label="Inscrição Estadual" k="inscricaoEstadual" form={form} set={set} />
                <F label="Inscrição Municipal" k="inscricaoMunicipal" form={form} set={set} />
                <F label="Representante" k="representanteLegal" form={form} set={set} />
              </>
            )}

            {/* Common */}
            <F label="Telefone" k="telefone" form={form} set={set} />
            <F label="Telefone 2" k="telefone2" form={form} set={set} />
            <F label="Email" k="email" form={form} set={set} type="email" />
            <F label="CEP" k="cep" form={form} set={set} />
            <F label="Endereço" k="endereco" form={form} set={set} />
            <F label="Cidade" k="cidade" form={form} set={set} />
            <div className="space-y-1.5">
              <label className={labelCls}>Estado</label>
              <select value={form.estado || ""} onChange={(e) => set("estado", e.target.value)} className={inputCls}>
                <option value="">Selecionar</option>
                {UFS_BRASIL.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <F label="Advogado Vinculado" k="advogadoVinculado" form={form} set={set} />
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Qualificação Completa</label>
            <textarea value={form.qualificacao || ""} onChange={(e) => set("qualificacao", e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Observações</label>
            <textarea value={form.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit">Cadastrar Parte</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, k, form, set, type, placeholder }: { label: string; k: string; form: Record<string, string>; set: (k: string, v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-muted-foreground">{label}</label>
      <input type={type || "text"} value={form[k] || ""} onChange={(e) => set(k, e.target.value)} placeholder={placeholder}
        className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}
