import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { db, addHistorico, parteComDocumento } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { ESTADOS_CIVIS, UFS_BRASIL, type ParteInteressada } from "@/types";
import { erroDocumento, tipoDocumentoDe } from "@/lib/documentos";
import { SeletorTipoPessoa, CampoDocumento } from "@/components/PessoaCampos";

interface Props {
  /** Quando passado, dispara callback com a parte recém-criada (uso inline em outros forms). */
  onSaved?: (parte?: ParteInteressada) => void;
  triggerLabel?: string;
  /** Permite usar o dialog em modo controlado (sem trigger interno). */
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: ReactNode;
  /** Título do diálogo (ex.: "Novo Manifestante"). */
  titulo?: string;
}

export function NovaParteDialog({ onSaved, triggerLabel, open: openExt, onOpenChange: onOpenChangeExt, trigger, titulo }: Props) {
  const [openInt, setOpenInt] = useState(false);
  const open = openExt ?? openInt;
  const setOpen = onOpenChangeExt ?? setOpenInt;
  const { currentUser } = useAuth();
  const [tipoPessoa, setTipoPessoa] = useState("Pessoa Física");
  // CPF e CNPJ ficam em campos separados: trocar PF ↔ PJ não perde o que foi digitado.
  const [form, setForm] = useState<Record<string, string>>({});
  const [duplicado, setDuplicado] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const pf = tipoPessoa === "Pessoa Física";
  const tipoDoc = tipoDocumentoDe(tipoPessoa);
  const documento = (tipoDoc === "cpf" ? form.cpf : form.cnpj) || "";

  useEffect(() => {
    let vivo = true;
    if (erroDocumento(tipoDoc, documento) || !documento) { setDuplicado(null); return; }
    parteComDocumento(documento).then((p) => { if (vivo) setDuplicado(p ? (p.nome || p.razaoSocial || "sem nome") : null); });
    return () => { vivo = false; };
  }, [documento, tipoDoc]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = pf ? form.nome : (form.razaoSocial || form.nome);
    if (!nome?.trim()) { toast.error(pf ? "Preencha o nome completo" : "Preencha a razão social"); return; }
    const erroDoc = erroDocumento(tipoDoc, documento);
    if (erroDoc) { toast.error(erroDoc); return; }
    // Confere de novo no envio (a checagem enquanto digita pode não ter terminado).
    const dup = documento ? await parteComDocumento(documento) : undefined;
    if (dup) { toast.error(`Este ${tipoDoc.toUpperCase()} já está cadastrado para "${dup.nome || dup.razaoSocial}".`); return; }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    // Grava só os campos do tipo escolhido (os do outro tipo ficam de fora).
    const soPF = (v?: string) => (pf ? v : undefined);
    const soPJ = (v?: string) => (pf ? undefined : v);
    const parte: ParteInteressada = {
      id, tipoPessoa,
      // Em PJ, "nome" recebe a razão social para listas e buscas funcionarem igual.
      nome: (pf ? form.nome : (form.razaoSocial || form.nome)) || "",
      nomeSocial: soPF(form.nomeSocial),
      razaoSocial: soPJ(form.razaoSocial),
      nomeFantasia: soPJ(form.nomeFantasia),
      cpfCnpj: documento || undefined, rg: soPF(form.rg), orgaoEmissor: soPF(form.orgaoEmissor),
      inscricaoEstadual: soPJ(form.inscricaoEstadual), inscricaoMunicipal: soPJ(form.inscricaoMunicipal),
      dataNascimento: soPF(form.dataNascimento), nacionalidade: soPF(form.nacionalidade),
      naturalidade: soPF(form.naturalidade), estadoCivil: soPF(form.estadoCivil),
      profissao: soPF(form.profissao), genero: soPF(form.genero),
      telefone: form.telefone, telefone2: form.telefone2, email: form.email,
      endereco: form.endereco, cep: form.cep, cidade: form.cidade, estado: form.estado,
      representanteLegal: soPJ(form.representanteLegal), advogadoVinculado: form.advogadoVinculado,
      qualificacao: form.qualificacao, dadosComplementares: form.dadosComplementares,
      observacoes: form.observacoes,
      status: "ativo",
      criadoPor: currentUser?.id || "",
      criadoEm: now, atualizadoEm: now,
    };
    await db.partes.add(parte);
    await addHistorico(id, "parte", "criacao", `Parte "${nome}" cadastrada`,
      currentUser?.id || "", currentUser?.nome || "");
    toast.success("Parte cadastrada!");
    setForm({}); setTipoPessoa("Pessoa Física");
    setOpen(false);
    onSaved?.(parte);
  };

  const inputCls = "w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
  const labelCls = "text-sm text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null
      ) : openExt === undefined && (
        <DialogTrigger asChild>
          <Button className="gap-2"><Plus className="h-4 w-4" /> {triggerLabel || "Nova Parte"}</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{titulo || "Nova Parte Interessada"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div className="space-y-1.5">
            <label className={labelCls}>Tipo de Pessoa *</label>
            <SeletorTipoPessoa value={tipoPessoa} onChange={setTipoPessoa} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pf ? (
              <>
                <F label="Nome Completo *" k="nome" form={form} set={set} />
                <F label="Nome Social" k="nomeSocial" form={form} set={set} />
                <CampoDocumento tipo="cpf" value={form.cpf || ""} onChange={(v) => set("cpf", v)} duplicado={duplicado} />
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
                <CampoDocumento tipo="cnpj" value={form.cnpj || ""} onChange={(v) => set("cnpj", v)} duplicado={duplicado} />
                <F label="Inscrição Estadual" k="inscricaoEstadual" form={form} set={set} />
                <F label="Inscrição Municipal" k="inscricaoMunicipal" form={form} set={set} />
                <F label="Representante" k="representanteLegal" form={form} set={set} />
              </>
            )}

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
