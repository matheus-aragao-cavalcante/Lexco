import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, X, UserPlus, Search, Loader2, ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { db, addHistorico } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { NovaParteDialog } from "@/components/NovaParteDialog";
import {
  AREAS_DIREITO, STATUS_PROCESSO, PRIORIDADES, ESFERAS,
  modelosDaModalidade, modeloPorId,
  type ParteInteressada, type ModeloNomenclatura,
} from "@/types";
import { EDICAO, NOMES_MODALIDADE, rotulosProcesso, type Modalidade } from "@/lib/edicao";
import { Gavel, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { consultarProcesso, parseNumeroCNJ, type DadosEncontrados, type ParteEncontrada } from "@/lib/consultaProcesso";
import { consultaPublica } from "@/lib/googleDrive";
import { RevisaoConsultaDialog, type SelecaoConsulta } from "@/components/RevisaoConsultaDialog";
import { formatarData } from "@/lib/dates";

/** Parte no polo: já cadastrada (parteId) ou nova, vinda da consulta (criada ao confirmar). */
interface ItemPolo { parteId: string; nome: string; nova?: boolean }
const normalizarNome = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const modeloInicial = (m: Modalidade): ModeloNomenclatura =>
  modeloPorId(EDICAO.modeloPadraoPorModalidade[m]) || modelosDaModalidade(m)[0];
const formInicial = (m: Modalidade): Record<string, string> => ({
  status: "ativo", prioridade: "Normal",
  esfera: m === "administrativo" ? "Pública" : "Particular",
  modeloNomenclaturaId: modeloInicial(m).id,
});

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
  // Polo que receberá a parte criada no cadastro rápido (null = só cadastra).
  const [novaPartePolo, setNovaPartePolo] = useState<"ativo" | "passivo" | null>(null);
  const [novaParteOpen, setNovaParteOpen] = useState(false);
  const [modalidade, setModalidade] = useState<Modalidade>(EDICAO.modalidadePadrao);
  const rot = rotulosProcesso(modalidade);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [modelo, setModelo] = useState<ModeloNomenclatura>(() => modeloInicial(EDICAO.modalidadePadrao));
  const [customPoloAtivo, setCustomPoloAtivo] = useState("");
  const [customPoloPassivo, setCustomPoloPassivo] = useState("");
  const [form, setForm] = useState<Record<string, string>>(() => formInicial(EDICAO.modalidadePadrao));

  const [poloAtivoPartes, setPoloAtivoPartes] = useState<ItemPolo[]>([]);
  const [poloPassivoPartes, setPoloPassivoPartes] = useState<ItemPolo[]>([]);
  // Consulta automática e confirmação final
  const [etapa, setEtapa] = useState<"formulario" | "confirmar">("formulario");
  const [buscando, setBuscando] = useState(false);
  const [encontrados, setEncontrados] = useState<DadosEncontrados | null>(null);
  const [revisaoOpen, setRevisaoOpen] = useState(false);
  const [movimentos, setMovimentos] = useState<DadosEncontrados["movimentos"]>([]);
  const [fonteUsada, setFonteUsada] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
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

  /** Troca judicial <-> administrativo: ajusta nomenclatura e esfera; o resto do formulário é mantido. */
  const handleModalidadeChange = (m: Modalidade) => {
    if (m === modalidade) return;
    setModalidade(m);
    if (!modelo.modalidades.includes(m)) {
      const novo = modeloInicial(m);
      setModelo(novo);
      set("modeloNomenclaturaId", novo.id);
    }
    if (m === "administrativo" && form.esfera === "Particular") set("esfera", "Pública");
  };

  const handleModeloChange = (id: string) => {
    const m = modeloPorId(id) || modeloInicial(modalidade);
    setModelo(m);
    set("modeloNomenclaturaId", id);
    if (!m.custom) { setCustomPoloAtivo(""); setCustomPoloPassivo(""); }
  };

  const addParte = (
    list: ItemPolo[],
    setList: (l: ItemPolo[]) => void,
    parteId: string,
  ) => {
    const p = partesDisponiveis.find((x) => x.id === parteId);
    if (!p || list.some((x) => x.parteId === parteId)) return;
    setList([...list, { parteId: p.id, nome: p.nome || p.razaoSocial || "" }]);
  };

  /** Quando uma nova parte é criada inline, recarrega lista e já permite escolher onde colocar. */
  const handleParteCriada = async (parte?: ParteInteressada) => {
    await reloadPartes();
    if (!parte) return;
    const item = { parteId: parte.id, nome: parte.nome || parte.razaoSocial || "" };
    if (novaPartePolo === "ativo") setPoloAtivoPartes((l) => [...l, item]);
    else if (novaPartePolo === "passivo") setPoloPassivoPartes((l) => [...l, item]);
    else toast.info(`"${item.nome}" disponível nos polos`);
  };
  const abrirNovaParte = (polo: "ativo" | "passivo" | null) => { setNovaPartePolo(polo); setNovaParteOpen(true); };

  const reset = () => {
    setModalidade(EDICAO.modalidadePadrao);
    setForm(formInicial(EDICAO.modalidadePadrao));
    setPoloAtivoPartes([]);
    setPoloPassivoPartes([]);
    setModelo(modeloInicial(EDICAO.modalidadePadrao));
    setCustomPoloAtivo("");
    setCustomPoloPassivo("");
    setEtapa("formulario");
    setEncontrados(null);
    setMovimentos([]);
    setFonteUsada("");
  };

  const labelAtivoAtual = modelo.custom ? (customPoloAtivo || "Polo Ativo") : modelo.poloAtivo;
  const labelPassivoAtual = modelo.custom ? (customPoloPassivo || "Polo Passivo") : modelo.poloPassivo;
  const numeroCNJ = parseNumeroCNJ(form.numero || "");
  const podeBuscar = modalidade === "judicial" && consultaPublica.disponivel();

  const buscarDados = async () => {
    if (!numeroCNJ) { toast.error("Digite o número completo no padrão CNJ (20 dígitos) para buscar."); return; }
    setBuscando(true);
    try {
      const r = await consultarProcesso(form.numero, consultaPublica);
      const nada = !r.partes.length && !r.movimentos.length && !r.tribunal && !r.orgaoJulgador && !r.classeProcessual;
      if (nada) { toast.info(r.avisos.join(" ") || "Nenhum dado encontrado. Preencha manualmente."); return; }
      setEncontrados(r);
      setRevisaoOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na consulta");
    } finally {
      setBuscando(false);
    }
  };

  /** Aplica o que o usuário marcou na revisão: campos, partes (existentes ou novas) e movimentações. */
  const aplicarConsulta = (sel: SelecaoConsulta) => {
    setForm((f) => ({ ...f, numero: encontrados?.numero || f.numero, ...sel.campos }));
    if (!form.titulo && sel.campos.classeProcessual) {
      const ativo = sel.partes.find((p) => p.polo === "ativo")?.nome;
      const passivo = sel.partes.find((p) => p.polo === "passivo")?.nome;
      set("titulo", ativo && passivo ? `${ativo} x ${passivo}` : sel.campos.classeProcessual);
    }
    const porNome = new Map(partesDisponiveis.map((p) => [normalizarNome(p.nome || p.razaoSocial || ""), p]));
    const adicionar = (lista: ItemPolo[], p: ParteEncontrada): ItemPolo[] => {
      const existente = porNome.get(normalizarNome(p.nome));
      const item: ItemPolo = existente
        ? { parteId: existente.id, nome: existente.nome || existente.razaoSocial || p.nome }
        : { parteId: `novo:${crypto.randomUUID()}`, nome: p.nome, nova: true };
      return lista.some((x) => normalizarNome(x.nome) === normalizarNome(item.nome)) ? lista : [...lista, item];
    };
    setPoloAtivoPartes((l) => sel.partes.filter((p) => p.polo === "ativo").reduce(adicionar, l));
    setPoloPassivoPartes((l) => sel.partes.filter((p) => p.polo === "passivo").reduce(adicionar, l));
    setMovimentos(sel.movimentos);
    const fontes = [...new Set(Object.values(encontrados?.origem || {}))].join(" e ");
    setFonteUsada(fontes);
    toast.success("Dados aplicados. Confira e complete o cadastro.");
  };

  /** 1º clique: valida e mostra o resumo para conferência. */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo) { toast.error("Informe o título do processo"); return; }
    if (form.numero) {
      const dup = await db.processos.where("numero").equals(form.numero.trim()).first();
      if (dup) { toast.error(`Já existe um processo com este número: "${dup.titulo}".`); return; }
    }
    setEtapa("confirmar");
  };

  /** 2º clique (na tela de conferência): grava tudo. */
  const confirmarCriacao = async () => {
    if (salvando) return;
    setSalvando(true);
    try {
      await criarProcesso();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o processo");
    } finally {
      setSalvando(false);
    }
  };

  const criarProcesso = async () => {
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
      modalidade,
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

    // Partes novas vindas da consulta: cadastra só com o nome (o resto o usuário completa).
    const garantirParte = async (item: ItemPolo) => {
      if (!item.nova) return item.parteId;
      const parteId = crypto.randomUUID();
      const pj = /\b(ltda|s\/?a|eireli|me|epp|estado|munic[ií]pio|uni[aã]o|instituto|banco|companhia|cia|associa|funda|minist[eé]rio|secretaria|prefeitura|tribunal)\b/i.test(item.nome);
      await db.partes.add({
        id: parteId, tipoPessoa: pj ? "Pessoa Jurídica" : "Pessoa Física",
        nome: item.nome, razaoSocial: pj ? item.nome : undefined, status: "ativo",
        observacoes: fonteUsada ? `Cadastrada a partir da consulta pública (${fonteUsada}).` : undefined,
        criadoPor: currentUser?.id || "", criadoEm: now, atualizadoEm: now,
      });
      await addHistorico(parteId, "parte", "criacao", `Parte "${item.nome}" cadastrada (consulta pública)`, currentUser?.id || "", currentUser?.nome || "");
      return parteId;
    };
    for (const p of poloAtivoPartes) {
      await db.vinculos.add({ id: crypto.randomUUID(), processoId: id, parteId: await garantirParte(p), tipoEnvolvimento: labelAtivo });
    }
    for (const p of poloPassivoPartes) {
      await db.vinculos.add({ id: crypto.randomUUID(), processoId: id, parteId: await garantirParte(p), tipoEnvolvimento: labelPassivo });
    }

    await addHistorico(id, "processo", "criacao",
      `Processo "${form.titulo}" criado${fonteUsada ? ` (dados conferidos a partir de ${fonteUsada})` : ""}`,
      currentUser?.id || "", currentUser?.nome || "");
    // Movimentações importadas viram andamentos (com a data original).
    for (const m of [...movimentos].reverse()) {
      await db.historico.add({
        id: crypto.randomUUID(), entidadeId: id, entidadeTipo: "processo", acao: "andamento",
        descricao: `${m.descricao} (importado do DataJud)`, usuarioId: currentUser?.id || "", usuarioNome: currentUser?.nome || "",
        data: new Date().toISOString(), dataReferencia: m.data.slice(0, 10) || undefined,
      });
    }
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
          {etapa === "confirmar" && (
            <ConfirmacaoProcesso
              form={form} rot={rot} modalidade={modalidade} users={users}
              labelAtivo={labelAtivoAtual} labelPassivo={labelPassivoAtual}
              poloAtivo={poloAtivoPartes} poloPassivo={poloPassivoPartes}
              movimentos={movimentos.length} fonte={fonteUsada} salvando={salvando}
              onVoltar={() => setEtapa("formulario")} onConfirmar={confirmarCriacao}
            />
          )}
          <form onSubmit={handleSubmit} className={cn("space-y-6 mt-2", etapa === "confirmar" && "hidden")}>
            {/* Dados Gerais */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-foreground border-b border-border pb-2 w-full">Dados Gerais</legend>
              {EDICAO.modalidades.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Modalidade</label>
                  <div className="flex gap-2">
                    {EDICAO.modalidades.map((m) => {
                      const Icon = m === "judicial" ? Gavel : Landmark;
                      const ativo = modalidade === m;
                      return (
                        <button key={m} type="button" onClick={() => handleModalidadeChange(m)} aria-pressed={ativo}
                          className={cn("flex-1 flex items-center justify-center gap-2 h-10 rounded-lg border text-sm transition-colors",
                            ativo ? "border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary" : "border-border bg-card text-muted-foreground hover:bg-muted/40")}>
                          <Icon className="h-4 w-4" /> {NOMES_MODALIDADE[m]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-sm text-muted-foreground">Título / Nome do Processo *</label>
                  <input value={form.titulo || ""} onChange={(e) => set("titulo", e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">{rot.numero}</label>
                  <div className="flex gap-2">
                    <input value={form.numero || ""} onChange={(e) => set("numero", e.target.value)} placeholder={rot.numeroPlaceholder} className={inputCls} />
                  </div>
                  {podeBuscar && (
                    <Button type="button" size="sm" variant="outline" className="w-full gap-1.5 mt-1.5" onClick={buscarDados} disabled={buscando || !numeroCNJ}
                      title={numeroCNJ ? "Consulta DataJud (CNJ) e DJEN" : "Digite o número completo no padrão CNJ"}>
                      {buscando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                      {buscando ? "Buscando nas fontes públicas..." : "Buscar Dados do Processo"}
                    </Button>
                  )}
                  {modalidade === "administrativo" && (
                    <p className="text-[11px] text-muted-foreground mt-1">Processos SPU/SEI não têm consulta pública automática: preencha manualmente.</p>
                  )}
                  {form.numero && modalidade === "judicial" && !numeroCNJ && form.numero.replace(/\D/g, "").length === 20 && (
                    <p className="text-[11px] text-destructive mt-1">Dígito verificador não confere — confira o número.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">{rot.areaDireito}</label>
                  <select value={form.areaDireito || ""} onChange={(e) => set("areaDireito", e.target.value)} className={inputCls}>
                    <option value="">Selecionar</option>
                    {AREAS_DIREITO.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">{rot.classeProcessual}</label>
                  <input value={form.classeProcessual || ""} onChange={(e) => set("classeProcessual", e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Assunto Principal</label>
                  <input value={form.assuntoPrincipal || ""} onChange={(e) => set("assuntoPrincipal", e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">{rot.orgaoJulgador}</label>
                  <input value={form.orgaoJulgador || ""} onChange={(e) => set("orgaoJulgador", e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">{rot.comarca}</label>
                  <input value={form.comarca || ""} onChange={(e) => set("comarca", e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">{rot.tribunal}</label>
                  <input value={form.tribunal || ""} onChange={(e) => set("tribunal", e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">{rot.instancia}</label>
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
                  <label className="text-sm text-muted-foreground">{rot.dataDistribuicao}</label>
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
                <Button type="button" size="sm" variant="outline" onClick={() => abrirNovaParte(null)}>
                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Nova Parte Interessada
                </Button>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Modelo de Nomenclatura</label>
                <select value={modelo.id} onChange={(e) => handleModeloChange(e.target.value)} className={inputCls}>
                  {modelosDaModalidade(modalidade).map((m) => <option key={m.id} value={m.id}>{m.nome} ({m.poloAtivo} / {m.poloPassivo})</option>)}
                </select>
              </div>

              {modelo.custom && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Nome do Polo Ativo</label>
                    <input value={customPoloAtivo} onChange={(e) => setCustomPoloAtivo(e.target.value)} placeholder={modalidade === "administrativo" ? "Ex: Manifestante" : "Ex: Autor"} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Nome do Polo Passivo</label>
                    <input value={customPoloPassivo} onChange={(e) => setCustomPoloPassivo(e.target.value)} placeholder={modalidade === "administrativo" ? "Ex: Interessado" : "Ex: Réu"} className={inputCls} />
                  </div>
                </div>
              )}

              <PoloSection
                label={modelo.custom ? (customPoloAtivo || "Polo Ativo") : modelo.poloAtivo}
                items={poloAtivoPartes}
                onRemove={(i) => setPoloAtivoPartes(poloAtivoPartes.filter((_, j) => j !== i))}
                partesDisponiveis={partesDisponiveis}
                onAdd={(id) => addParte(poloAtivoPartes, setPoloAtivoPartes, id)}
                onNova={() => abrirNovaParte("ativo")}
              />

              <PoloSection
                label={modelo.custom ? (customPoloPassivo || "Polo Passivo") : modelo.poloPassivo}
                items={poloPassivoPartes}
                onRemove={(i) => setPoloPassivoPartes(poloPassivoPartes.filter((_, j) => j !== i))}
                partesDisponiveis={partesDisponiveis}
                onAdd={(id) => addParte(poloPassivoPartes, setPoloPassivoPartes, id)}
                onNova={() => abrirNovaParte("passivo")}
              />
            </fieldset>

            {/* Informações Complementares */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-foreground border-b border-border pb-2 w-full">Informações Complementares</legend>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">{rot.objetoAcao}</label>
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
              <Button type="submit">Revisar e criar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <RevisaoConsultaDialog
        open={revisaoOpen} onOpenChange={setRevisaoOpen} dados={encontrados} atuais={form} rot={rot}
        labelAtivo={labelAtivoAtual} labelPassivo={labelPassivoAtual} onAplicar={aplicarConsulta}
      />

      {/* Modal de cadastro inline de Parte Interessada (não fecha o de processo) */}
      <NovaParteDialog
        open={novaParteOpen}
        onOpenChange={setNovaParteOpen}
        trigger={null}
        onSaved={handleParteCriada}
        titulo={novaPartePolo === "ativo"
          ? `Cadastrar ${modelo.custom ? (customPoloAtivo || "Polo Ativo") : modelo.poloAtivo}`
          : novaPartePolo === "passivo"
            ? `Cadastrar ${modelo.custom ? (customPoloPassivo || "Polo Passivo") : modelo.poloPassivo}`
            : undefined}
      />
    </>
  );
}

function PoloSection({ label, items, onRemove, partesDisponiveis, onAdd, onNova }: {
  label: string;
  items: ItemPolo[];
  onRemove: (i: number) => void;
  partesDisponiveis: ParteInteressada[];
  onAdd: (id: string) => void;
  onNova: () => void;
}) {
  return (
    <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <button type="button" onClick={onNova} className="text-xs text-primary hover:underline flex items-center gap-1">
          <UserPlus className="h-3.5 w-3.5" /> Cadastrar e adicionar
        </button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 bg-card rounded px-3 py-1.5 text-sm">
          <span className="flex-1 text-foreground">{item.nome}{item.nova && <span className="ml-2 text-[10px] uppercase text-primary bg-primary/10 rounded px-1.5 py-0.5">nova</span>}</span>
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

/** Resumo para conferência antes de gravar o processo. */
function ConfirmacaoProcesso({ form, rot, modalidade, users, labelAtivo, labelPassivo, poloAtivo, poloPassivo, movimentos, fonte, salvando, onVoltar, onConfirmar }: {
  form: Record<string, string>;
  rot: ReturnType<typeof rotulosProcesso>;
  modalidade: Modalidade;
  users: { id: string; nome: string }[];
  labelAtivo: string;
  labelPassivo: string;
  poloAtivo: ItemPolo[];
  poloPassivo: ItemPolo[];
  movimentos: number;
  fonte: string;
  salvando: boolean;
  onVoltar: () => void;
  onConfirmar: () => void;
}) {
  const linhas: [string, string | undefined][] = [
    ["Modalidade", NOMES_MODALIDADE[modalidade]],
    ["Título", form.titulo],
    [rot.numero, form.numero],
    [rot.areaDireito, form.areaDireito],
    [rot.classeProcessual, form.classeProcessual],
    ["Assunto Principal", form.assuntoPrincipal],
    [rot.orgaoJulgador, form.orgaoJulgador],
    [rot.comarca, form.comarca],
    [rot.tribunal, form.tribunal],
    [rot.instancia, form.instancia],
    ["Esfera", form.esfera],
    ["Status", form.status ? form.status.charAt(0).toUpperCase() + form.status.slice(1) : undefined],
    ["Prioridade", form.prioridade],
    [rot.dataDistribuicao, form.dataDistribuicao ? formatarData(form.dataDistribuicao) : undefined],
    ["Responsável", users.find((u) => u.id === form.responsavelId)?.nome],
    [rot.objetoAcao, form.objetoAcao],
  ];
  const vazios = linhas.filter(([, v]) => !v).map(([k]) => k);
  const polo = (titulo: string, itens: ItemPolo[]) => (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground mb-1">{titulo}</p>
      {itens.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma parte</p> : itens.map((i) => (
        <p key={i.parteId} className="text-sm text-foreground">
          {i.nome}{i.nova && <span className="ml-2 text-[10px] uppercase text-primary bg-primary/10 rounded px-1.5 py-0.5">será cadastrada</span>}
        </p>
      ))}
    </div>
  );
  return (
    <div className="space-y-4 mt-2">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm flex gap-2">
        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <span>Confira se os dados estão corretos antes de concluir o cadastro.{fonte && <> Parte deles veio da consulta pública ({fonte}).</>}</span>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {linhas.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="border-b border-border pb-1.5">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-foreground break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {polo(labelAtivo, poloAtivo)}
        {polo(labelPassivo, poloPassivo)}
      </div>
      {movimentos > 0 && <p className="text-sm text-foreground flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> {movimentos} movimentação(ões) serão importadas como andamentos.</p>}
      {vazios.length > 0 && <p className="text-xs text-muted-foreground">Em branco: {vazios.join(", ")}. Você pode completar depois na tela do processo.</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onVoltar} disabled={salvando}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar e corrigir</Button>
        <Button type="button" onClick={onConfirmar} disabled={salvando}>
          {salvando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />} Confirmar e criar processo
        </Button>
      </div>
    </div>
  );
}
