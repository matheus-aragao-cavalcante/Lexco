import { AppLayout } from "@/components/AppLayout";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { hojeISO, formatarData } from "@/lib/dates";
import { db, addHistorico, deleteProcessoCascata, contarDependenciasProcesso } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { PrazoDialog } from "@/components/PrazoDialog";
import { EventoDialog } from "@/components/EventoDialog";
import { TarefaDialog } from "@/components/TarefaDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft, FolderOpen, Users, Clock, CalendarDays,
  MessageSquare, History, Save, Edit, X, Paperclip,
  Plus, Pencil, Trash2, CheckCheck, AlertTriangle, FileText,
  ListTodo, Send, Sparkles, RotateCcw, Gavel, Landmark,
} from "lucide-react";
import type { Processo, VinculoProcessoParte, ParteInteressada, Prazo, Evento, Arquivo, HistoricoAlteracao, User } from "@/types";
import { toast } from "sonner";
import { STATUS_PROCESSO, PRIORIDADES, ESFERAS, AREAS_DIREITO, TIPO_LABELS, modelosDaModalidade, modeloPorId } from "@/types";
import { EDICAO, NOMES_MODALIDADE, modalidadeDoProcesso, rotulosProcesso, type Modalidade } from "@/lib/edicao";
import {
  salvarProcesso, ConflitoEdicaoError, rebasearFormulario, rebasearBase, registrarAndamento, diferencas,
  type Detalhe,
} from "@/lib/alteracoes";
import { ehTarefa, excluirTarefa } from "@/lib/tarefas";
import { cn } from "@/lib/utils";
import { DocumentosProcesso } from "@/components/DocumentosProcesso";

const formDe = (obj: object) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => typeof v === "string") as [string, string][]);

/** Rascunho local das alterações não salvas (sobrevive a troca de tela e fechamento do app). */
const chaveRascunho = (uid: string, pid: string) => `lexco_rascunho_processo_${uid}_${pid}`;
const chaveVisto = (uid: string, pid: string) => `lexco_visto_processo_${uid}_${pid}`;
interface Rascunho { alteracoes: Detalhe[]; salvoEm: string }

const HORAS_RECENTE = 48;

type FiltroHistorico = "tudo" | "andamentos" | "dados" | "agenda";
const FILTROS_HISTORICO: { id: FiltroHistorico; label: string }[] = [
  { id: "tudo", label: "Tudo" },
  { id: "andamentos", label: "Andamentos" },
  { id: "dados", label: "Alterações de dados" },
  { id: "agenda", label: "Prazos, eventos e tarefas" },
];
const filtraHistorico = (h: HistoricoAlteracao, f: FiltroHistorico) =>
  f === "tudo" ? true
    : f === "andamentos" ? h.acao === "andamento"
      : f === "dados" ? h.acao === "edicao" || h.acao === "criacao" || h.acao.startsWith("parte_")
        : /^(prazo|evento|tarefa)_/.test(h.acao);

function tempoRelativo(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

const ProcessoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, permissoes: perm, ambiente } = useAuth();
  const podeEditar = perm.editarProcessos;
  const podeTarefas = perm.tarefas === "editar";
  const uid = currentUser?.id || "";
  const autor = { id: uid, nome: currentUser?.nome || "" };
  const [processo, setProcesso] = useState<Processo | null>(null);
  /** Versão do processo a partir da qual a edição atual começou (para detectar conflitos). */
  const [base, setBase] = useState<Processo | null>(null);
  const [vinculos, setVinculos] = useState<(VinculoProcessoParte & { parte?: ParteInteressada })[]>([]);
  const [prazos, setPrazos] = useState<Prazo[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [historico, setHistorico] = useState<HistoricoAlteracao[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tab, setTab] = useState("geral");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [conflito, setConflito] = useState<ConflitoEdicaoError | null>(null);
  const [confirmDescartar, setConfirmDescartar] = useState<null | "cancelar" | "voltar">(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [ultimaVisita, setUltimaVisita] = useState<string | null>(null);
  const [histFiltro, setHistFiltro] = useState<FiltroHistorico>("tudo");
  const [andamentoTexto, setAndamentoTexto] = useState("");
  const [andamentoData, setAndamentoData] = useState(hojeISO());

  // Refs para o load() enxergar o estado mais recente (rebase de edição em andamento).
  const baseRef = useRef<Processo | null>(null);
  const formRef = useRef<Record<string, string>>({});
  baseRef.current = base;
  formRef.current = form;

  const alteracoes: Detalhe[] = base ? diferencas(base, form) : [];
  const sujo = alteracoes.length > 0;
  const camposAlterados = new Set(alteracoes.map((d) => d.campo));

  // dialogs
  const [prazoDialogOpen, setPrazoDialogOpen] = useState(false);
  const [editingPrazo, setEditingPrazo] = useState<Prazo | null>(null);
  const [eventoDialogOpen, setEventoDialogOpen] = useState(false);
  const [editingEvento, setEditingEvento] = useState<Evento | null>(null);
  const [tarefaDialogOpen, setTarefaDialogOpen] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<Evento | null>(null);
  const [confirmPrazoDel, setConfirmPrazoDel] = useState<Prazo | null>(null);
  const [confirmEventoDel, setConfirmEventoDel] = useState<Evento | null>(null);
  const [confirmProcDel, setConfirmProcDel] = useState(false);
  const [deps, setDeps] = useState<{ prazos: number; eventos: number; arquivos: number; vinculos: number; historico: number } | null>(null);

  // Ao abrir o processo: guarda a última visita (para destacar novidades) e procura rascunho.
  useEffect(() => {
    if (!id || !uid) return;
    setUltimaVisita(localStorage.getItem(chaveVisto(uid, id)));
    localStorage.setItem(chaveVisto(uid, id), new Date().toISOString());
    try {
      const r = localStorage.getItem(chaveRascunho(uid, id));
      setRascunho(r ? (JSON.parse(r) as Rascunho) : null);
    } catch {
      setRascunho(null);
    }
    setEditing(false);
    load(true);
  }, [id, uid]);

  // Mantém o rascunho em dia enquanto houver alterações não salvas.
  useEffect(() => {
    if (!id || !uid || !processo) return;
    if (sujo) {
      // Com um rascunho antigo ainda pendente (banner), não o sobrescreve.
      if (!rascunho) localStorage.setItem(chaveRascunho(uid, id), JSON.stringify({ alteracoes, salvoEm: new Date().toISOString() } satisfies Rascunho));
    } else if (!rascunho) {
      localStorage.removeItem(chaveRascunho(uid, id));
    }
  }, [form, processo, rascunho]);

  const load = async (inicial = false) => {
    if (!id) return;
    const p = await db.processos.get(id);
    if (!p) { navigate("/processos"); return; }
    const anterior = baseRef.current;
    const formAtual = formRef.current;
    const editandoEste = !inicial && anterior?.id === p.id && diferencas(anterior, formAtual).length > 0;
    setProcesso(p);
    if (editandoEste && anterior) {
      setForm(rebasearFormulario(anterior, p, formAtual));
      setBase(rebasearBase(anterior, p, formAtual));
    } else {
      setForm(formDe(p));
      setBase(p);
    }

    const vs = await db.vinculos.where("processoId").equals(id).toArray();
    const vWithParte = await Promise.all(vs.map(async (v) => ({ ...v, parte: await db.partes.get(v.parteId) })));
    setVinculos(vWithParte);

    setPrazos((await db.prazos.where("processoId").equals(id).toArray())
      .sort((a, b) => a.dataLimite.localeCompare(b.dataLimite)));
    setEventos((await db.eventos.where("processoId").equals(id).toArray())
      .sort((a, b) => `${a.data}${a.horaInicio || ""}`.localeCompare(`${b.data}${b.horaInicio || ""}`)));
    setArquivos(await db.arquivos.where("entidadeId").equals(id).toArray());
    setHistorico((await db.historico.where("entidadeId").equals(id).toArray())
      .sort((a, b) => b.data.localeCompare(a.data)));
    setUsers(await db.users.toArray());
  };

  const nomeUsuario = (uidX?: string) => (uidX ? users.find((u) => u.id === uidX)?.nome : undefined);

  const descartar = () => {
    if (processo) { setForm(formDe(processo)); setBase(processo); }
    setEditing(false);
    if (id && uid) localStorage.removeItem(chaveRascunho(uid, id));
    setRascunho(null);
  };
  const pedirCancelar = () => (sujo ? setConfirmDescartar("cancelar") : setEditing(false));
  const pedirVoltar = () => (sujo ? setConfirmDescartar("voltar") : navigate("/processos"));

  const recuperarRascunho = () => {
    if (!rascunho || !processo) return;
    // A base volta a ser o valor de quando o rascunho foi feito: se alguém mudou
    // o mesmo campo depois, o salvamento mostra o conflito em vez de sobrescrever.
    const f = { ...formDe(processo) };
    const b = { ...processo } as unknown as Record<string, unknown>;
    let mudouNoMeioTempo = 0;
    for (const d of rascunho.alteracoes) {
      if (String(processo[d.campo as keyof Processo] ?? "") !== d.de) mudouNoMeioTempo++;
      f[d.campo] = d.para;
      b[d.campo] = d.de === "" ? undefined : d.de;
    }
    setBase(b as unknown as Processo);
    setForm(f);
    setEditing(true);
    setRascunho(null);
    if (mudouNoMeioTempo > 0) {
      toast.warning(`${mudouNoMeioTempo} campo(s) do rascunho foram alterados por outra pessoa depois. Ao salvar você poderá escolher qual valor manter.`);
    } else {
      toast.success("Alterações recuperadas. Revise e salve.");
    }
  };
  const descartarRascunho = () => {
    if (id && uid) localStorage.removeItem(chaveRascunho(uid, id));
    setRascunho(null);
  };

  const executarSalvar = async (base: Processo, dados: Record<string, string>) => {
    setSalvando(true);
    try {
      const r = await salvarProcesso(base, dados, autor);
      if (id && uid) localStorage.removeItem(chaveRascunho(uid, id));
      setRascunho(null);
      setConflito(null);
      setEditing(false);
      if (r.detalhes.length === 0) {
        toast.info("Nenhuma alteração para salvar");
      } else {
        toast.success(r.mesclou
          ? "Processo salvo! Alterações feitas por outras pessoas em outros campos foram mantidas."
          : "Processo salvo!");
      }
      setProcesso(r.processo);
      setBase(r.processo);
      setForm(formDe(r.processo));
      baseRef.current = r.processo;
      formRef.current = formDe(r.processo);
      load();
    } catch (e) {
      if (e instanceof ConflitoEdicaoError) setConflito(e);
      else toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setSalvando(false);
    }
  };
  const handleSave = () => { if (base) executarSalvar(base, form); };

  /** Conflito: o usuário decide manter os valores dele ou aceitar os atuais. */
  const manterMeus = () => {
    if (!conflito || !base) return;
    executarSalvar(conflito.atual, rebasearFormulario(base, conflito.atual, form));
  };
  const usarAtuais = () => {
    if (!conflito || !base) return;
    const f = rebasearFormulario(base, conflito.atual, form);
    for (const c of conflito.conflitos) f[c.campo] = c.atual;
    setProcesso(conflito.atual);
    setBase(conflito.atual);
    setForm(f);
    setConflito(null);
    toast.info("Valores atualizados. Suas outras alterações continuam pendentes.");
  };

  const handleRegistrarAndamento = async () => {
    if (!id || !andamentoTexto.trim()) { toast.error("Descreva o andamento"); return; }
    await registrarAndamento(id, andamentoTexto, andamentoData, autor);
    setAndamentoTexto("");
    setAndamentoData(hojeISO());
    toast.success("Andamento registrado");
    load();
  };

  const openConfirmDelete = async () => {
    if (!id) return;
    setDeps(await contarDependenciasProcesso(id));
    setConfirmProcDel(true);
  };

  const handleDeleteProcesso = async () => {
    if (!id) return;
    await deleteProcessoCascata(id);
    if (uid) localStorage.removeItem(chaveRascunho(uid, id));
    toast.success("Processo excluído");
    navigate("/processos");
  };

  const handleConcluirPrazo = async (p: Prazo) => {
    await db.prazos.put({ ...p, status: "cumprido", atualizadoEm: new Date().toISOString() });
    await addHistorico(p.id, "prazo", "concluido", `Prazo "${p.titulo}" cumprido`, autor.id, autor.nome);
    if (id) await addHistorico(id, "processo", "prazo_concluido", `Prazo "${p.titulo}" cumprido`, autor.id, autor.nome);
    toast.success("Prazo cumprido!");
    load();
  };

  const handleDeletePrazo = async () => {
    if (!confirmPrazoDel) return;
    await db.prazos.delete(confirmPrazoDel.id);
    await addHistorico(confirmPrazoDel.id, "prazo", "exclusao", `Prazo "${confirmPrazoDel.titulo}" excluído`, autor.id, autor.nome);
    if (id) await addHistorico(id, "processo", "prazo_excluido", `Prazo "${confirmPrazoDel.titulo}" excluído`, autor.id, autor.nome);
    toast.success("Prazo excluído");
    setConfirmPrazoDel(null);
    load();
  };

  const handleDeleteEvento = async () => {
    if (!confirmEventoDel) return;
    const rotulo = ehTarefa(confirmEventoDel) ? "Tarefa" : "Evento";
    if (ehTarefa(confirmEventoDel)) {
      await excluirTarefa(confirmEventoDel, autor);
      await addHistorico(confirmEventoDel.id, "evento", "exclusao", `Tarefa "${confirmEventoDel.titulo}" excluída`, autor.id, autor.nome);
      toast.success("Tarefa excluída");
      setConfirmEventoDel(null);
      load();
      return;
    }
    await db.eventos.delete(confirmEventoDel.id);
    await addHistorico(confirmEventoDel.id, "evento", "exclusao", `${rotulo} "${confirmEventoDel.titulo}" excluído`, autor.id, autor.nome);
    if (id) await addHistorico(id, "processo", ehTarefa(confirmEventoDel) ? "tarefa_exclusao" : "evento_excluido",
      `${rotulo} "${confirmEventoDel.titulo}" excluíd${rotulo === "Tarefa" ? "a" : "o"}`, autor.id, autor.nome);
    toast.success(`${rotulo} excluíd${rotulo === "Tarefa" ? "a" : "o"}`);
    setConfirmEventoDel(null);
    load();
  };

  const abrirEvento = (e: Evento) => {
    if (ehTarefa(e)) { setEditingTarefa(e); setTarefaDialogOpen(true); }
    else { setEditingEvento(e); setEventoDialogOpen(true); }
  };

  const handleRemoverVinculo = async (vinculoId: string, parteName: string) => {
    await db.vinculos.delete(vinculoId);
    if (id) await addHistorico(id, "processo", "parte_removida", `Parte "${parteName}" removida do processo`, autor.id, autor.nome);
    toast.success("Vínculo removido");
    load();
  };

  if (!processo) return <AppLayout><div className="py-12 text-center text-muted-foreground">Carregando...</div></AppLayout>;

  const modalidade = modalidadeDoProcesso({ modalidade: form.modalidade || processo.modalidade });
  const rot = rotulosProcesso(modalidade);

  // visão geral metrics
  const today = hojeISO();
  const proximoPrazo = prazos.find((p) => p.status !== "cumprido");
  const prazosAbertos = prazos.filter((p) => p.status !== "cumprido").length;
  const prazosVencidos = prazos.filter((p) => p.dataLimite < today && p.status !== "cumprido").length;
  const eventosFuturos = eventos.filter((e) => e.data >= today && e.status !== "cancelado" && !ehTarefa(e)).length;
  const tarefasAbertas = eventos.filter((e) => ehTarefa(e) && (e.status === "pendente" || e.status === "em_andamento")).length;
  const ultimaAtualizacao = processo.atualizadoEm ? new Date(processo.atualizadoEm) : null;
  const diasSemAtualizacao = ultimaAtualizacao ? Math.floor((Date.now() - ultimaAtualizacao.getTime()) / 86400000) : 0;
  const quemAtualizou = nomeUsuario(processo.atualizadoPor);

  const ehNovo = (h: HistoricoAlteracao) => !!ultimaVisita && h.data > ultimaVisita && h.usuarioId !== uid;
  const ehRecente = (h: HistoricoAlteracao) => Date.now() - new Date(h.data).getTime() < HORAS_RECENTE * 3600000;
  const novidades = historico.filter(ehNovo);
  const andamentos = historico.filter((h) => h.acao === "andamento");
  const historicoFiltrado = historico.filter((h) => filtraHistorico(h, histFiltro));

  const tabs = [
    { id: "geral", label: "Visão Geral", icon: FolderOpen },
    { id: "dados", label: "Dados", icon: FileText },
    { id: "partes", label: `Partes (${vinculos.length})`, icon: Users },
    { id: "prazos", label: `Prazos (${prazos.length})`, icon: Clock },
    { id: "eventos", label: `Eventos e Tarefas (${eventos.length})`, icon: CalendarDays },
    { id: "arquivos", label: `Arquivos (${arquivos.length})`, icon: Paperclip },
    { id: "observacoes", label: "Observações", icon: MessageSquare },
    { id: "historico", label: `Histórico${novidades.length ? ` • ${novidades.length} novo(s)` : ""}`, icon: History },
  ].filter((t) => (t.id !== "arquivos" || perm.documentos !== "nenhum") && (t.id !== "historico" || perm.verHistorico));

  const inputCls = "w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-default";
  const destaque = (campo: string) => (camposAlterados.has(campo) ? "ring-2 ring-warning/60 border-warning" : "");
  const setF = (campo: string) => (v: string) => setForm({ ...form, [campo]: v });

  const renderEntrada = (h: HistoricoAlteracao, compacto?: boolean) => {
    const novo = ehNovo(h);
    const andamento = h.acao === "andamento";
    return (
      <div key={h.id} className={cn("p-3 rounded-lg transition-colors", novo ? "bg-warning/10 border border-warning/30" : andamento ? "bg-primary/5" : "hover:bg-muted/50")}>
        <div className="flex items-start justify-between gap-3">
          <p className={cn("text-sm text-foreground", andamento ? "whitespace-pre-wrap" : "font-medium")}>
            {andamento && <span className="text-xs font-semibold text-primary mr-1.5">ANDAMENTO{h.dataReferencia ? ` · ${formatarData(h.dataReferencia)}` : ""}</span>}
            {h.descricao}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {novo && <span className="text-[10px] font-semibold uppercase bg-warning text-warning-foreground rounded px-1.5 py-0.5">Novo</span>}
            {!novo && ehRecente(h) && <span className="text-[10px] uppercase text-primary bg-primary/10 rounded px-1.5 py-0.5">Recente</span>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5" title={new Date(h.data).toLocaleString("pt-BR")}>
          {h.usuarioNome || "—"} · {new Date(h.data).toLocaleString("pt-BR")} ({tempoRelativo(h.data)})
        </p>
        {!compacto && h.detalhes && h.detalhes.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs">
            {h.detalhes.map((d) => (
              <li key={d.campo} className="flex flex-wrap gap-1">
                <span className="text-muted-foreground">{d.rotulo}:</span>
                <span className="line-through text-muted-foreground/80 max-w-[40ch] truncate">{d.de || "(vazio)"}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-foreground font-medium max-w-[40ch] truncate">{d.para || "(vazio)"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className={cn("space-y-6 max-w-6xl", sujo && "pb-20")}>
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={pedirVoltar}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-heading font-semibold text-foreground">{processo.titulo}</h1>
              <StatusBadge status={processo.status} />
              {EDICAO.modalidades.length > 1 && (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border flex items-center gap-1">
                  {modalidadeDoProcesso(processo) === "judicial" ? <Gavel className="h-3 w-3" /> : <Landmark className="h-3 w-3" />}
                  {NOMES_MODALIDADE[modalidadeDoProcesso(processo)]}
                </span>
              )}
              {processo.prioridade && (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  processo.prioridade === "Urgente" ? "bg-destructive/10 text-destructive border-destructive/20" :
                  processo.prioridade === "Alta" ? "bg-primary/10 text-primary border-primary/20" :
                  "bg-muted text-muted-foreground border-border"
                }`}>{processo.prioridade}</span>
              )}
            </div>
            {processo.numero && <p className="text-sm text-muted-foreground font-mono mt-1">{processo.numero}</p>}
            {ultimaAtualizacao && (
              <p className="text-xs text-muted-foreground mt-1">
                Última atualização {tempoRelativo(processo.atualizadoEm)}{quemAtualizou ? ` por ${quemAtualizou}` : ""} · {ultimaAtualizacao.toLocaleString("pt-BR")}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {podeEditar && (
              <>
                <Button variant="outline" size="sm" onClick={() => { setEditingPrazo(null); setPrazoDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Prazo
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setEditingEvento(null); setEventoDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Evento
                </Button>
              </>
            )}
            {podeTarefas && (
              <Button variant="outline" size="sm" onClick={() => { setEditingTarefa(null); setTarefaDialogOpen(true); }}>
                <ListTodo className="h-4 w-4 mr-1" /> Tarefa
              </Button>
            )}
            {perm.excluirProcessos && (
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={openConfirmDelete}>
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            )}
          </div>
        </div>

        {rascunho && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <p className="text-foreground">
              <RotateCcw className="inline h-4 w-4 mr-1 text-warning" />
              Há {rascunho.alteracoes.length} alteração(ões) não salva(s) de {new Date(rascunho.salvoEm).toLocaleString("pt-BR")}
              {" "}({rascunho.alteracoes.map((a) => a.rotulo).join(", ")}).
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={descartarRascunho}>Descartar</Button>
              <Button size="sm" onClick={recuperarRascunho}>Recuperar</Button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Visão Geral */}
        {tab === "geral" && (
          <div className="space-y-4">
            {novidades.length > 0 && (
              <button onClick={() => setTab("historico")}
                className="w-full flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-left hover:bg-warning/15 transition-colors">
                <Sparkles className="h-4 w-4 text-warning shrink-0" />
                <span className="text-foreground">
                  <strong>{novidades.length} atualização(ões)</strong> de outras pessoas desde a sua última visita
                  {ultimaVisita ? ` (${new Date(ultimaVisita).toLocaleString("pt-BR")})` : ""}: {[...new Set(novidades.map((n) => n.usuarioNome))].join(", ")}.
                </span>
                <span className="ml-auto text-xs text-primary whitespace-nowrap">Ver histórico →</span>
              </button>
            )}

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card icon={Clock} label="Prazos abertos" value={prazosAbertos} variant="default" />
              <Card icon={AlertTriangle} label="Prazos vencidos" value={prazosVencidos} variant={prazosVencidos > 0 ? "destructive" : "default"} />
              <Card icon={CalendarDays} label="Eventos futuros" value={eventosFuturos} variant="primary" />
              <Card icon={ListTodo} label="Tarefas abertas" value={tarefasAbertas} variant="default" />
              <Card icon={History} label="Dias sem atualização" value={diasSemAtualizacao} variant={diasSemAtualizacao > 15 ? "warning" : "default"} />
            </div>

            {(podeEditar || andamentos.length > 0) && (
            <div className="bg-card rounded-lg border shadow-card p-5 space-y-3">
              <h3 className="font-heading font-semibold text-foreground">{podeEditar ? "Registrar andamento" : "Últimos andamentos"}</h3>
              {podeEditar && (<>
              <textarea value={andamentoTexto} onChange={(e) => setAndamentoTexto(e.target.value)} rows={2}
                placeholder="Ex.: Juntada de manifestação; processo concluso para decisão..."
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleRegistrarAndamento(); }}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="text-xs text-muted-foreground flex items-center gap-2">
                  Data do andamento
                  <input type="date" value={andamentoData} onChange={(e) => setAndamentoData(e.target.value)} className="h-8 px-2 rounded-lg border border-input bg-background text-sm" />
                </label>
                <Button size="sm" onClick={handleRegistrarAndamento} disabled={!andamentoTexto.trim()}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Registrar
                </Button>
              </div>
              </>)}
              {andamentos.length > 0 && (
                <div className="pt-2 border-t border-border space-y-2">
                  <p className="text-xs text-muted-foreground">Últimos andamentos</p>
                  {andamentos.slice(0, 3).map((h) => renderEntrada(h, true))}
                </div>
              )}
            </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card rounded-lg border shadow-card p-5">
                <h3 className="font-heading font-semibold text-foreground mb-3">Próximo prazo</h3>
                {proximoPrazo ? (
                  <div className="space-y-1">
                    <button onClick={() => { setEditingPrazo(proximoPrazo); setPrazoDialogOpen(true); }}
                      className="font-medium text-foreground hover:text-primary">{proximoPrazo.titulo}</button>
                    <p className="text-sm text-muted-foreground">{formatarData(proximoPrazo.dataLimite)}</p>
                    <StatusBadge status={proximoPrazo.status} />
                  </div>
                ) : <p className="text-sm text-muted-foreground">Nenhum prazo pendente</p>}
              </div>

              <div className="bg-card rounded-lg border shadow-card p-5">
                <h3 className="font-heading font-semibold text-foreground mb-3">Resumo</h3>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">{rot.areaDireito}</dt><dd className="text-foreground">{processo.areaDireito || "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">{rot.tribunal}</dt><dd className="text-foreground">{processo.tribunal || "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">{rot.orgaoJulgador}</dt><dd className="text-foreground">{processo.orgaoJulgador || "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">{rot.comarca}</dt><dd className="text-foreground">{processo.comarca || "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Responsável</dt><dd className="text-foreground">{nomeUsuario(processo.responsavelId) || "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Partes</dt><dd className="text-foreground">{vinculos.length}</dd></div>
                </dl>
              </div>
            </div>

            <div className="bg-card rounded-lg border shadow-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-semibold text-foreground">Atividade recente</h3>
                {historico.length > 5 && <button onClick={() => setTab("historico")} className="text-xs text-primary hover:underline">Ver tudo</button>}
              </div>
              {historico.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma atividade registrada</p>
              ) : (
                <div className="space-y-1">
                  {historico.slice(0, 5).map((h) => renderEntrada(h, true))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Dados */}
        {tab === "dados" && (
          <div className="bg-card rounded-lg border shadow-card p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-heading font-semibold text-foreground">Dados do Processo</h2>
              {editing ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={pedirCancelar}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
                  <Button size="sm" onClick={handleSave} disabled={salvando || !sujo}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
                </div>
              ) : (
                podeEditar && <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Edit className="h-4 w-4 mr-1" /> Editar</Button>
              )}
            </div>
            {editing && <p className="text-xs text-muted-foreground">Os campos alterados ficam destacados. Só eles serão gravados — mudanças feitas por outras pessoas nos demais campos são preservadas.</p>}
            {editing && !perm.editarSensiveis && (
              <p className="text-xs text-warning">Número, modalidade e nomenclatura das partes só podem ser alterados por quem tem permissão para dados sensíveis.</p>
            )}
            {editing && EDICAO.modalidades.length > 1 && perm.editarSensiveis && (
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Modalidade</label>
                <div className="flex gap-2 max-w-md">
                  {EDICAO.modalidades.map((m) => (
                    <button key={m} type="button" aria-pressed={modalidade === m}
                      onClick={() => {
                        const atualOk = modeloPorId(form.modeloNomenclaturaId)?.modalidades.includes(m);
                        setForm({ ...form, modalidade: m, ...(atualOk ? {} : { modeloNomenclaturaId: EDICAO.modeloPadraoPorModalidade[m] }) });
                      }}
                      className={cn("flex-1 flex items-center justify-center gap-2 h-9 rounded-lg border text-sm transition-colors",
                        modalidade === m ? "border-primary bg-primary/10 text-primary font-medium" : "border-border bg-card text-muted-foreground hover:bg-muted/40",
                        destaque("modalidade"))}>
                      {m === "judicial" ? <Gavel className="h-4 w-4" /> : <Landmark className="h-4 w-4" />} {NOMES_MODALIDADE[m]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {editing && perm.editarSensiveis && (
                <Sel label="Nomenclatura das partes" value={form.modeloNomenclaturaId} disabled={!editing} onChange={setF("modeloNomenclaturaId")} cls={destaque("modeloNomenclaturaId")}
                  options={modelosDaModalidade(modalidade)
                    .filter((m) => !m.custom || m.id === processo.modeloNomenclaturaId)
                    .map((m) => [m.id, m.custom ? `${m.nome} (${processo.labelPoloAtivo} / ${processo.labelPoloPassivo})` : `${m.nome} (${m.poloAtivo} / ${m.poloPassivo})`] as [string, string])} />
              )}
              <Fd label="Título" value={form.titulo} disabled={!editing} onChange={setF("titulo")} cls={destaque("titulo")} />
              <Fd label={rot.numero} value={form.numero} disabled={!editing || !perm.editarSensiveis} onChange={setF("numero")} cls={destaque("numero")} placeholder={rot.numeroPlaceholder} />
              <Sel label={rot.areaDireito} value={form.areaDireito} disabled={!editing} onChange={setF("areaDireito")} cls={destaque("areaDireito")}
                options={[["", "—"], ...AREAS_DIREITO.map((a) => [a, a] as [string, string])]} />
              <Fd label={rot.classeProcessual} value={form.classeProcessual} disabled={!editing} onChange={setF("classeProcessual")} cls={destaque("classeProcessual")} />
              <Fd label="Assunto Principal" value={form.assuntoPrincipal} disabled={!editing} onChange={setF("assuntoPrincipal")} cls={destaque("assuntoPrincipal")} />
              <Fd label={rot.orgaoJulgador} value={form.orgaoJulgador} disabled={!editing} onChange={setF("orgaoJulgador")} cls={destaque("orgaoJulgador")} />
              <Fd label={rot.comarca} value={form.comarca} disabled={!editing} onChange={setF("comarca")} cls={destaque("comarca")} />
              <Fd label={rot.tribunal} value={form.tribunal} disabled={!editing} onChange={setF("tribunal")} cls={destaque("tribunal")} />
              <Fd label={rot.instancia} value={form.instancia} disabled={!editing} onChange={setF("instancia")} cls={destaque("instancia")} />
              <Sel label="Esfera" value={form.esfera} disabled={!editing} onChange={setF("esfera")} cls={destaque("esfera")}
                options={[["", "—"], ...ESFERAS.map((a) => [a, a] as [string, string])]} />
              <Sel label="Status" value={form.status} disabled={!editing} onChange={setF("status")} cls={destaque("status")}
                options={STATUS_PROCESSO.map((s) => [s, s.charAt(0).toUpperCase() + s.slice(1)] as [string, string])} />
              <Sel label="Prioridade" value={form.prioridade} disabled={!editing} onChange={setF("prioridade")} cls={destaque("prioridade")}
                options={[["", "—"], ...PRIORIDADES.map((a) => [a, a] as [string, string])]} />
              <Fd label={rot.dataDistribuicao} value={form.dataDistribuicao} disabled={!editing} onChange={setF("dataDistribuicao")} type="date" cls={destaque("dataDistribuicao")} />
              <Sel label="Responsável" value={form.responsavelId} disabled={!editing} onChange={setF("responsavelId")} cls={destaque("responsavelId")}
                options={[["", "—"], ...users.filter((u) => u.status === "ativo" || u.id === form.responsavelId).map((u) => [u.id, u.nome] as [string, string])]} />
            </div>
          </div>
        )}

        {/* Tab: Partes */}
        {tab === "partes" && (
          <div className="bg-card rounded-lg border shadow-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-heading font-semibold text-foreground">Partes Envolvidas</h2>
              <p className="text-xs text-muted-foreground">{processo.labelPoloAtivo} / {processo.labelPoloPassivo}</p>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nome</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Papel</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden md:table-cell">CPF/CNPJ</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden md:table-cell">Contato</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">Ações</th>
              </tr></thead>
              <tbody>
                {vinculos.map((v) => (
                  <tr key={v.id} className="border-t border-border hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <Link to={`/partes/${v.parteId}`} className="font-medium text-foreground hover:text-primary hover:underline">
                        {v.parte?.nome || v.parte?.razaoSocial || "—"}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">{v.tipoEnvolvimento}</span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-xs hidden md:table-cell">{v.parte?.cpfCnpj || "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{v.parte?.telefone || v.parte?.email || "—"}</td>
                    <td className="py-3 px-4 text-right">
                      {perm.editarSensiveis && (
                        <Button size="icon" variant="ghost" onClick={() => handleRemoverVinculo(v.id, v.parte?.nome || v.parte?.razaoSocial || "")}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {vinculos.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma parte vinculada</div>}
          </div>
        )}

        {/* Tab: Prazos */}
        {tab === "prazos" && (
          <div className="space-y-4">
            {podeEditar && (
              <div className="flex justify-end">
                <Button onClick={() => { setEditingPrazo(null); setPrazoDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Novo Prazo
                </Button>
              </div>
            )}
            <div className="bg-card rounded-lg border shadow-card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/50">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Prazo</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data Limite</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">Ações</th>
                </tr></thead>
                <tbody>
                  {prazos.map((p) => (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <button onClick={() => { setEditingPrazo(p); setPrazoDialogOpen(true); }}
                          className="font-medium text-foreground hover:text-primary text-left">{p.titulo}</button>
                      </td>
                      <td className="py-3 px-4 text-foreground">{formatarData(p.dataLimite)}{p.hora ? ` ${p.hora}` : ""}</td>
                      <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                      <td className="py-3 px-4">
                        {podeEditar && <div className="flex justify-end gap-1">
                          {p.status !== "cumprido" && (
                            <Button size="icon" variant="ghost" onClick={() => handleConcluirPrazo(p)} title="Cumprido">
                              <CheckCheck className="h-4 w-4 text-success" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => { setEditingPrazo(p); setPrazoDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setConfirmPrazoDel(p)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {prazos.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">Nenhum prazo cadastrado</div>}
            </div>
          </div>
        )}

        {/* Tab: Eventos e Tarefas */}
        {tab === "eventos" && (
          <div className="space-y-4">
            <div className="flex justify-end gap-2">
              {podeTarefas && (
                <Button variant="outline" onClick={() => { setEditingTarefa(null); setTarefaDialogOpen(true); }}>
                  <ListTodo className="h-4 w-4 mr-1" /> Nova Tarefa
                </Button>
              )}
              {podeEditar && (
                <Button onClick={() => { setEditingEvento(null); setEventoDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Novo Evento
                </Button>
              )}
            </div>
            <div className="bg-card rounded-lg border shadow-card p-5 space-y-3">
              {eventos.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">Nenhum evento ou tarefa vinculado</div>}
              {eventos.map((e) => {
                const tarefa = ehTarefa(e);
                const Icone = tarefa ? ListTodo : CalendarDays;
                const resp = (e.responsaveisIds || []).map(nomeUsuario).filter(Boolean);
                return (
                  <div key={e.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <Icone className={cn("h-4 w-4 mt-0.5 flex-shrink-0", tarefa ? "text-accent" : "text-primary")} />
                    <div className="flex-1 min-w-0">
                      <button onClick={() => (tarefa ? podeTarefas : podeEditar) && abrirEvento(e)}
                        className={cn("text-sm font-medium hover:text-primary text-left", tarefa && e.status === "concluido" ? "line-through text-muted-foreground" : "text-foreground")}>{e.titulo}</button>
                      <p className="text-xs text-muted-foreground">
                        {formatarData(e.data)} {e.horaInicio && `· ${e.horaInicio}`} · {TIPO_LABELS[e.tipo] || e.tipo}
                        {resp.length > 0 && ` · ${resp.join(", ")}`}
                      </p>
                    </div>
                    <StatusBadge status={e.status} />
                    {(tarefa ? podeTarefas : podeEditar) && <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => abrirEvento(e)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmEventoDel(e)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab: Arquivos (Google Drive) */}
        {tab === "arquivos" && (
          <DocumentosProcesso
            processo={processo} arquivos={arquivos} autor={autor}
            podeAnexar={perm.documentos === "anexar"}
            compartilharCom={ambiente?.donoEmail}
            onMudou={() => load()}
          />
        )}

        {/* Tab: Observações */}
        {tab === "observacoes" && (
          <div className="bg-card rounded-lg border shadow-card p-6 space-y-4">
            <h2 className="font-heading font-semibold text-foreground">Observações e Estratégia</h2>
            <div className="grid grid-cols-1 gap-4">
              {[
                { label: rot.objetoAcao, key: "objetoAcao" },
                { label: "Resumo do Caso", key: "resumoCaso" },
                { label: "Fundamentos", key: "fundamentos" },
                { label: "Estratégia", key: "estrategia" },
                { label: "Riscos", key: "riscos" },
                { label: "Observações Internas", key: "observacoes" },
                { label: "Andamento (texto livre)", key: "andamento" },
              ].map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">{f.label}{camposAlterados.has(f.key) && <span className="text-warning ml-1">• alterado</span>}</label>
                  <textarea value={form[f.key] || ""} readOnly={!podeEditar} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} rows={2}
                    className={cn("w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y", destaque(f.key))} />
                </div>
              ))}
            </div>
            {podeEditar && <Button onClick={handleSave} disabled={salvando || !sujo}><Save className="h-4 w-4 mr-1" /> Salvar Observações</Button>}
          </div>
        )}

        {/* Tab: Histórico */}
        {tab === "historico" && (
          <div className="bg-card rounded-lg border shadow-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="font-heading font-semibold text-foreground">Histórico de Alterações</h2>
              <div className="flex gap-1 bg-muted rounded-lg p-1 flex-wrap">
                {FILTROS_HISTORICO.map((f) => (
                  <button key={f.id} onClick={() => setHistFiltro(f.id)}
                    className={cn("px-2.5 py-1 rounded text-xs transition-colors", histFiltro === f.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground")}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {historicoFiltrado.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro neste filtro</p>}
            <div className="relative">
              {historicoFiltrado.length > 0 && <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />}
              <div className="space-y-3">
                {historicoFiltrado.map((h) => (
                  <div key={h.id} className="relative pl-10">
                    <div className={cn("absolute left-2.5 top-3.5 h-3 w-3 rounded-full border-2",
                      ehNovo(h) ? "bg-warning border-warning" : h.acao === "andamento" ? "bg-primary border-primary" : "bg-card border-primary")} />
                    {renderEntrada(h)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Barra fixa de alterações não salvas (visível em qualquer aba) */}
      {sujo && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(720px,calc(100vw-2rem))] rounded-lg border border-warning/40 bg-card shadow-lg p-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <p className="text-sm text-foreground flex-1 min-w-0 truncate" title={alteracoes.map((a) => a.rotulo).join(", ")}>
            {alteracoes.length} alteração(ões) não salva(s): {alteracoes.map((a) => a.rotulo).join(", ")}
          </p>
          <Button size="sm" variant="outline" onClick={() => setConfirmDescartar("cancelar")}>Descartar</Button>
          <Button size="sm" onClick={handleSave} disabled={salvando}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
        </div>
      )}

      {/* Dialogs */}
      <PrazoDialog open={prazoDialogOpen} onOpenChange={setPrazoDialogOpen}
        prazo={editingPrazo} processoId={id} onSaved={() => load()} />
      <EventoDialog open={eventoDialogOpen} onOpenChange={setEventoDialogOpen}
        evento={editingEvento} processoId={id} onSaved={() => load()} />
      <TarefaDialog open={tarefaDialogOpen} onOpenChange={setTarefaDialogOpen}
        tarefa={editingTarefa} processoId={id} onSaved={() => load()} />

      <Dialog open={!!conflito} onOpenChange={(v) => !v && setConflito(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-heading">Alteração simultânea</DialogTitle>
            <DialogDescription>
              {conflito?.atualizadoPorNome || "Outra pessoa"} alterou {conflito?.conflitos.length === 1 ? "um campo" : "campos"} que você também editou.
              Escolha qual valor manter. Nenhuma informação foi gravada ainda.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {conflito?.conflitos.map((c) => (
              <div key={c.campo} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium text-foreground mb-1">{c.rotulo}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-primary/5 p-2"><span className="text-muted-foreground block">Seu valor</span><span className="whitespace-pre-wrap break-words">{c.meu || "(vazio)"}</span></div>
                  <div className="rounded bg-warning/10 p-2"><span className="text-muted-foreground block">Valor atual{conflito.atualizadoPorNome ? ` (${conflito.atualizadoPorNome})` : ""}</span><span className="whitespace-pre-wrap break-words">{c.atual || "(vazio)"}</span></div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2 flex-wrap">
            <Button variant="outline" onClick={() => setConflito(null)}>Voltar à edição</Button>
            <Button variant="outline" onClick={usarAtuais}>Usar valores atuais</Button>
            <Button onClick={manterMeus} disabled={salvando}>Manter os meus</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDescartar}
        onOpenChange={(v) => !v && setConfirmDescartar(null)}
        title="Descartar alterações?"
        description={`As alterações não salvas (${alteracoes.map((a) => a.rotulo).join(", ")}) serão perdidas.`}
        confirmLabel="Descartar"
        onConfirm={() => {
          const acao = confirmDescartar;
          descartar();
          setConfirmDescartar(null);
          if (acao === "voltar") navigate("/processos");
        }}
      />
      <ConfirmDialog
        open={!!confirmPrazoDel}
        onOpenChange={(v) => !v && setConfirmPrazoDel(null)}
        title="Excluir prazo?"
        description={confirmPrazoDel ? `O prazo "${confirmPrazoDel.titulo}" será removido.` : ""}
        confirmLabel="Excluir"
        onConfirm={handleDeletePrazo}
      />
      <ConfirmDialog
        open={!!confirmEventoDel}
        onOpenChange={(v) => !v && setConfirmEventoDel(null)}
        title={confirmEventoDel && ehTarefa(confirmEventoDel) ? "Excluir tarefa?" : "Excluir evento?"}
        description={confirmEventoDel ? `"${confirmEventoDel.titulo}" será removido.` : ""}
        confirmLabel="Excluir"
        onConfirm={handleDeleteEvento}
      />
      <ConfirmDialog
        open={confirmProcDel}
        onOpenChange={setConfirmProcDel}
        title="Excluir processo?"
        description={`Esta ação removerá o processo e todos os itens vinculados:\n• ${deps?.prazos || 0} prazo(s)\n• ${deps?.eventos || 0} evento(s)/tarefa(s)\n• ${deps?.arquivos || 0} arquivo(s)\n• ${deps?.vinculos || 0} vínculo(s) com partes\n• ${deps?.historico || 0} entrada(s) de histórico`}
        confirmLabel="Excluir tudo"
        onConfirm={handleDeleteProcesso}
      />
    </AppLayout>
  );
};

function Fd({ label, value, disabled, onChange, type, cls, placeholder }: { label: string; value?: string; disabled: boolean; onChange: (v: string) => void; type?: string; cls?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-muted-foreground">{label}</label>
      <input type={type || "text"} value={value || ""} disabled={disabled} placeholder={disabled ? undefined : placeholder} onChange={(e) => onChange(e.target.value)}
        className={cn("w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-default", cls)} />
    </div>
  );
}

function Sel({ label, value, disabled, onChange, options, cls }: { label: string; value?: string; disabled: boolean; onChange: (v: string) => void; options: [string, string][]; cls?: string }) {
  // Valor legado fora da lista continua visível.
  const opts = value && !options.some(([v]) => v === value) ? [...options, [value, value] as [string, string]] : options;
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-muted-foreground">{label}</label>
      <select value={value || ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className={cn("w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-default", cls)}>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function Card({ icon: Icon, label, value, variant }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; variant: "default" | "destructive" | "primary" | "warning" }) {
  const cls = {
    default: "bg-muted/40 text-foreground",
    destructive: "bg-destructive/10 text-destructive",
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
  }[variant];
  return (
    <div className="bg-card rounded-lg border shadow-card p-4">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-2 ${cls}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-heading font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export default ProcessoDetalhe;
