import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, X, UserPlus } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { db, addHistorico } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { NovaParteDialog } from "@/components/NovaParteDialog";
import {
  MODELOS_NOMENCLATURA, AREAS_DIREITO, STATUS_PROCESSO, PRIORIDADES, ESFERAS,
  type ParteInteressada,
} from "@/types";

/**
 * Diálogo de criação de processo.
 *
 * Após salvar, redireciona para /processos/:id para o usuário continuar
 * enriquecendo o processo (prazos, eventos, arquivos, observações).
 *
 * Permite cadastrar nova parte interessada inline (botão "+ Nova Parte"),
 * sem sair do formulário; a parte criada é automaticamente disponibilizada
 * para vínculo aos polos.
 */
export function NovoProcessoDialog({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [novaParteOpen, setNovaParteOpen] = useState(false);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [modelo, setModelo] = useState(MODELOS_NOMENCLATURA[0]);
  const [customPoloAtivo, setCustomPoloAtivo] = useState("");
  const [customPoloPassivo, setCustomPoloPassivo] = useState("");
  const [form, setForm] = useState<Record<string, string>>({
    status: "ativo", prioridade: "Normal", esfera: "Particular", modeloNomenclaturaId: "civel",
  });

  const [poloAtivoPartes, setPoloAtivoPartes] = useState<{ parteId: string; nome: string }[]>([]);
  const [poloPassivoPartes, setPoloPassivoPartes] = useState<{ parteId: string; nome: string }[]>([]);
  const [partesDisponiveis, setPartesDisponiveis] = useState<ParteInteressada[]>([]);
  const [users, setUsers] = useState<{ id: string; nome: string }[]>([]);

  const reloadPartes = () => db.partes.toArray().then(setPartesDisponiveis);

  useEffect(() => {
    if (open) {
      reloadPartes();
      db.users.where("status").equals("ativo").toArray().then((u) =>
        setUsers(u.map((x) => ({ id: x.id, nome: x.nome }))),
      );
    }
  }, [open]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleModeloChange = (id: string) => {
    const m = MODELOS_NOMENCLATURA.find((x) => x.id === id) || MODELOS_NOMENCLATURA[0];
    setModelo(m);
    set("modeloNomenclaturaId", id);
    if (!m.custom) { setCustomPoloAtivo(""); setCustomPoloPassivo(""); }
  };

  const addParte = (
    list: { parteId: string; nome: string }[],
    setList: (l: { parteId: string; nome: string }[]) => void,
    parteId: string,
  ) => {
    const p = partesDisponiveis.find((x) => x.id === parteId);
    if (!p || list.some((x) => x.parteId === parteId)) return;
    setList([...list, { parteId: p.id, nome: p.nome || p.razaoSocial || "" }]);
  };

  /** Quando uma nova parte é criada inline, recarrega lista e já permite escolher onde colocar. */
  const handleParteCriada = async (parte?: ParteInteressada) => {
    await reloadPartes();
    if (parte) toast.info(`"${parte.nome || parte.razaoSocial}" disponível nos polos`);
  };

  const reset = () => {
    setForm({ status: "ativo", prioridade: "Normal", esfera: "Particular", modeloNomenclaturaId: "civel" });
    setPoloAtivoPartes([]);
    setPoloPassivoPartes([]);
    setModelo(MODELOS_NOMENCLATURA[0]);
    setCustomPoloAtivo("");
    setCustomPoloPassivo("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo) { toast.error("Informe o título do processo"); return; }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const labelAtivo = modelo.custom ? (customPoloAtivo || "Polo Ativo") : modelo.poloAtivo;
    const labelPassivo = modelo.custom ? (customPoloPassivo || "Polo Passivo") : modelo.poloPassivo;

    await db.processos.add({
      id, titulo: form.titulo, numero: form.numero,
      areaDireito: form.areaDireito, subarea: form.subarea,
      classeProcessual: form.classeProcessual, assuntoPrincipal: form.assuntoPrincipal,
      orgaoJulgador: form.orgaoJulgador, comarca: form.comarca,
      tribunal: form.tribunal, vara: form.vara,
      instancia: form.instancia, esfera: form.esfera,
      status: (form.status as Parameters<typeof db.processos.add>[0]["status"]) || "ativo",
      prioridade: form.prioridade, dataDistribuicao: form.dataDistribuicao,
      dataCadastro: now,
      responsavelId: form.responsavelId || currentUser?.id || "",
      equipeIds: [],
      objetoAcao: form.objetoAcao, resumoCaso: form.resumoCaso, observacoes: form.observacoes,
      tags: [],
      modeloNomenclaturaId: form.modeloNomenclaturaId,
      labelPoloAtivo: labelAtivo, labelPoloPassivo: labelPassivo,
      criadoPor: currentUser?.id || "",
      atualizadoEm: now, atualizadoPor: currentUser?.id || "",
    });

    for (const p of poloAtivoPartes) {
      await db.vinculos.add({ id: crypto.randomUUID(), processoId: id, parteId: p.parteId, tipoEnvolvimento: labelAtivo });
    }
    for (const p of poloPassivoPartes) {
      await db.vinculos.add({ id: crypto.randomUUID(), processoId: id, parteId: p.parteId, tipoEnvolvimento: labelPassivo });
    }

    await addHistorico(id, "processo", "criacao", `Processo "${form.titulo}" criado`,
      currentUser?.id || "", currentUser?.nome || "");
    toast.success("Processo criado! Continue o cadastro.");
    reset();
    setOpen(false);
    onSaved?.();
    // Redireciona para a página dinâmica do processo
    navigate(`/processos/${id}`);
  };

  const inputCls = "w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Processo</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[780px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Novo Processo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 mt-2">
            {/* Dados Gerais */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-foreground border-b border-border pb-2 w-full">Dados Gerais</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-sm text-muted-foreground">Título / Nome do Processo *</label>
                  <input value={form.titulo || ""} onChange={(e) => set("titulo", e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Número do Processo</label>
                  <input value={form.numero || ""} onChange={(e) => set("numero", e.target.value)} placeholder="0000000-00.0000.0.00.0000" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Área do Direito</label>
                  <select value={form.areaDireito || ""} onChange={(e) => set("areaDireito", e.target.value)} className={inputCls}>
                    <option value="">Selecionar</option>
                    {AREAS_DIREITO.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Classe Processual</label>
                  <input value={form.classeProcessual || ""} onChange={(e) => set("classeProcessual", e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Assunto Principal</label>
                  <input value={form.assuntoPrincipal || ""} onChange={(e) => set("assuntoPrincipal", e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Órgão Julgador</label>
                  <input value={form.orgaoJulgador || ""} onChange={(e) => set("orgaoJulgador", e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Comarca / Vara</label>
                  <input value={form.comarca || ""} onChange={(e) => set("comarca", e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Tribunal / Órgão</label>
                  <input value={form.tribunal || ""} onChange={(e) => set("tribunal", e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Instância</label>
                  <input value={form.instancia || ""} onChange={(e) => set("instancia", e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Esfera</label>
                  <select value={form.esfera || ""} onChange={(e) => set("esfera", e.target.value)} className={inputCls}>
                    {ESFERAS.map((es) => <option key={es} value={es}>{es}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Status</label>
                  <select value={form.status || "ativo"} onChange={(e) => set("status", e.target.value)} className={inputCls}>
                    {STATUS_PROCESSO.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Prioridade</label>
                  <select value={form.prioridade || "Normal"} onChange={(e) => set("prioridade", e.target.value)} className={inputCls}>
                    {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Data de Distribuição</label>
                  <input type="date" value={form.dataDistribuicao || ""} onChange={(e) => set("dataDistribuicao", e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Responsável Principal</label>
                  <select value={form.responsavelId || ""} onChange={(e) => set("responsavelId", e.target.value)} className={inputCls}>
                    <option value="">Selecionar</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
              </div>
            </fieldset>

            {/* Partes / Polos */}
            <fieldset className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <legend className="text-sm font-semibold text-foreground">Partes Envolvidas</legend>
                <Button type="button" size="sm" variant="outline" onClick={() => setNovaParteOpen(true)}>
                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Nova Parte Interessada
                </Button>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Modelo de Nomenclatura</label>
                <select value={modelo.id} onChange={(e) => handleModeloChange(e.target.value)} className={inputCls}>
                  {MODELOS_NOMENCLATURA.map((m) => <option key={m.id} value={m.id}>{m.nome} ({m.poloAtivo} / {m.poloPassivo})</option>)}
                </select>
              </div>

              {modelo.custom && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Nome do Polo Ativo</label>
                    <input value={customPoloAtivo} onChange={(e) => setCustomPoloAtivo(e.target.value)} placeholder="Ex: Autor" className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Nome do Polo Passivo</label>
                    <input value={customPoloPassivo} onChange={(e) => setCustomPoloPassivo(e.target.value)} placeholder="Ex: Réu" className={inputCls} />
                  </div>
                </div>
              )}

              <PoloSection
                label={modelo.custom ? (customPoloAtivo || "Polo Ativo") : modelo.poloAtivo}
                items={poloAtivoPartes}
                onRemove={(i) => setPoloAtivoPartes(poloAtivoPartes.filter((_, j) => j !== i))}
                partesDisponiveis={partesDisponiveis}
                onAdd={(id) => addParte(poloAtivoPartes, setPoloAtivoPartes, id)}
              />

              <PoloSection
                label={modelo.custom ? (customPoloPassivo || "Polo Passivo") : modelo.poloPassivo}
                items={poloPassivoPartes}
                onRemove={(i) => setPoloPassivoPartes(poloPassivoPartes.filter((_, j) => j !== i))}
                partesDisponiveis={partesDisponiveis}
                onAdd={(id) => addParte(poloPassivoPartes, setPoloPassivoPartes, id)}
              />
            </fieldset>

            {/* Informações Complementares */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-foreground border-b border-border pb-2 w-full">Informações Complementares</legend>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Objeto da Ação</label>
                <textarea value={form.objetoAcao || ""} onChange={(e) => set("objetoAcao", e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Resumo do Caso</label>
                <textarea value={form.resumoCaso || ""} onChange={(e) => set("resumoCaso", e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Observações</label>
                <textarea value={form.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
            </fieldset>

            <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-background pb-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">Criar e abrir processo</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de cadastro inline de Parte Interessada (não fecha o de processo) */}
      <NovaParteDialog
        open={novaParteOpen}
        onOpenChange={setNovaParteOpen}
        trigger={null}
        onSaved={handleParteCriada}
      />
    </>
  );
}

function PoloSection({ label, items, onRemove, partesDisponiveis, onAdd }: {
  label: string;
  items: { parteId: string; nome: string }[];
  onRemove: (i: number) => void;
  partesDisponiveis: ParteInteressada[];
  onAdd: (id: string) => void;
}) {
  return (
    <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/20">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 bg-card rounded px-3 py-1.5 text-sm">
          <span className="flex-1 text-foreground">{item.nome}</span>
          <button type="button" onClick={() => onRemove(i)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
        </div>
      ))}
      <select
        onChange={(e) => { if (e.target.value) { onAdd(e.target.value); e.target.value = ""; } }}
        className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        defaultValue=""
      >
        <option value="">+ Adicionar parte cadastrada...</option>
        {partesDisponiveis
          .filter((p) => !items.some((i) => i.parteId === p.id))
          .map((p) => (
            <option key={p.id} value={p.id}>{p.nome || p.razaoSocial} {p.cpfCnpj ? `(${p.cpfCnpj})` : ""}</option>
          ))}
      </select>
    </div>
  );
}
