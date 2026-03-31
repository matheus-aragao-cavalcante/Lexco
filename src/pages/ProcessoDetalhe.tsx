import { AppLayout } from "@/components/AppLayout";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { db, addHistorico } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { NovoPrazoDialog } from "@/components/NovoPrazoDialog";
import {
  ArrowLeft, FileText, FolderOpen, Users, Clock, CalendarDays,
  MessageSquare, History, Save, Edit, X, Paperclip,
} from "lucide-react";
import type { Processo, VinculoProcessoParte, ParteInteressada, Prazo, Evento, Arquivo, HistoricoAlteracao } from "@/types";
import { toast } from "sonner";
import { AREAS_DIREITO, STATUS_PROCESSO, PRIORIDADES, ESFERAS } from "@/types";

const ProcessoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [processo, setProcesso] = useState<Processo | null>(null);
  const [vinculos, setVinculos] = useState<(VinculoProcessoParte & { parte?: ParteInteressada })[]>([]);
  const [prazos, setPrazos] = useState<Prazo[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [historico, setHistorico] = useState<HistoricoAlteracao[]>([]);
  const [tab, setTab] = useState("geral");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    if (!id) return;
    const p = await db.processos.get(id);
    if (!p) { navigate("/processos"); return; }
    setProcesso(p);
    setForm(Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === "string") as [string, string][]));

    const vs = await db.vinculos.where("processoId").equals(id).toArray();
    const vWithParte = await Promise.all(vs.map(async (v) => ({ ...v, parte: await db.partes.get(v.parteId) })));
    setVinculos(vWithParte);

    setPrazos(await db.prazos.where("processoId").equals(id).toArray());
    const allEvts = await db.eventos.toArray();
    setEventos(allEvts.filter((e) => e.processoId === id));
    setArquivos(await db.arquivos.where("entidadeId").equals(id).toArray());
    setHistorico((await db.historico.where("entidadeId").equals(id).toArray()).sort((a, b) => b.data.localeCompare(a.data)));
  };

  const handleSave = async () => {
    if (!processo || !id) return;
    const updated = {
      ...processo, ...form,
      status: (form.status as any) || processo.status,
      atualizadoEm: new Date().toISOString(),
      atualizadoPor: currentUser?.id || "",
    };
    await db.processos.put(updated);
    await addHistorico(id, "processo", "edicao", "Dados do processo atualizados", currentUser?.id || "", currentUser?.nome || "");
    setProcesso(updated);
    setEditing(false);
    toast.success("Processo salvo!");
    load();
  };

  if (!processo) return <AppLayout><div className="py-12 text-center text-muted-foreground">Carregando...</div></AppLayout>;

  const tabs = [
    { id: "geral", label: "Visão Geral", icon: FolderOpen },
    { id: "partes", label: `Partes (${vinculos.length})`, icon: Users },
    { id: "prazos", label: `Prazos (${prazos.length})`, icon: Clock },
    { id: "eventos", label: `Eventos (${eventos.length})`, icon: CalendarDays },
    { id: "arquivos", label: `Arquivos (${arquivos.length})`, icon: Paperclip },
    { id: "observacoes", label: "Observações", icon: MessageSquare },
    { id: "historico", label: "Histórico", icon: History },
  ];

  const inputCls = "w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-default";

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/processos")}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-heading font-semibold text-foreground">{processo.titulo}</h1>
              <StatusBadge status={processo.status} />
              {processo.prioridade && (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  processo.prioridade === "Urgente" ? "bg-destructive/10 text-destructive border-destructive/20" :
                  processo.prioridade === "Alta" ? "bg-primary/10 text-primary border-primary/20" :
                  "bg-muted text-muted-foreground border-border"
                }`}>{processo.prioridade}</span>
              )}
            </div>
            {processo.numero && <p className="text-sm text-muted-foreground font-mono mt-1">{processo.numero}</p>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Visão Geral */}
        {tab === "geral" && (
          <div className="bg-card rounded-lg border shadow-card p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-heading font-semibold text-foreground">Dados do Processo</h2>
              {editing ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
                  <Button size="sm" onClick={handleSave}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Edit className="h-4 w-4 mr-1" /> Editar</Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Fd label="Título" value={form.titulo} disabled={!editing} onChange={(v) => setForm({ ...form, titulo: v })} />
              <Fd label="Número" value={form.numero} disabled={!editing} onChange={(v) => setForm({ ...form, numero: v })} />
              <Fd label="Área do Direito" value={form.areaDireito} disabled={!editing} onChange={(v) => setForm({ ...form, areaDireito: v })} />
              <Fd label="Classe Processual" value={form.classeProcessual} disabled={!editing} onChange={(v) => setForm({ ...form, classeProcessual: v })} />
              <Fd label="Órgão Julgador" value={form.orgaoJulgador} disabled={!editing} onChange={(v) => setForm({ ...form, orgaoJulgador: v })} />
              <Fd label="Comarca" value={form.comarca} disabled={!editing} onChange={(v) => setForm({ ...form, comarca: v })} />
              <Fd label="Tribunal" value={form.tribunal} disabled={!editing} onChange={(v) => setForm({ ...form, tribunal: v })} />
              <Fd label="Instância" value={form.instancia} disabled={!editing} onChange={(v) => setForm({ ...form, instancia: v })} />
              <Fd label="Esfera" value={form.esfera} disabled={!editing} onChange={(v) => setForm({ ...form, esfera: v })} />
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Status</label>
                <select value={form.status || ""} disabled={!editing} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                  {STATUS_PROCESSO.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <Fd label="Prioridade" value={form.prioridade} disabled={!editing} onChange={(v) => setForm({ ...form, prioridade: v })} />
              <Fd label="Data Distribuição" value={form.dataDistribuicao} disabled={!editing} onChange={(v) => setForm({ ...form, dataDistribuicao: v })} type="date" />
            </div>
          </div>
        )}

        {/* Tab: Partes */}
        {tab === "partes" && (
          <div className="bg-card rounded-lg border shadow-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-semibold text-foreground">Partes Envolvidas</h2>
                <p className="text-xs text-muted-foreground">{processo.labelPoloAtivo} / {processo.labelPoloPassivo}</p>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nome</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Papel</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden md:table-cell">CPF/CNPJ</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden md:table-cell">Contato</th>
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
            <div className="flex justify-end">
              <NovoPrazoDialog processoId={id} onSaved={load} />
            </div>
            <div className="bg-card rounded-lg border shadow-card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/50">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Prazo</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data Limite</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                </tr></thead>
                <tbody>
                  {prazos.map((p) => (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium text-foreground">{p.titulo}</td>
                      <td className="py-3 px-4 text-foreground">{p.dataLimite}</td>
                      <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {prazos.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">Nenhum prazo cadastrado</div>}
            </div>
          </div>
        )}

        {/* Tab: Eventos */}
        {tab === "eventos" && (
          <div className="bg-card rounded-lg border shadow-card p-5 space-y-3">
            {eventos.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">Nenhum evento vinculado</div>}
            {eventos.map((e) => (
              <div key={e.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                <CalendarDays className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{e.titulo}</p>
                  <p className="text-xs text-muted-foreground">{e.data} {e.horaInicio && `· ${e.horaInicio}`} · {e.tipo}</p>
                </div>
                <StatusBadge status={e.status} />
              </div>
            ))}
          </div>
        )}

        {/* Tab: Arquivos */}
        {tab === "arquivos" && (
          <div className="bg-card rounded-lg border shadow-card p-5 space-y-3">
            <p className="text-sm text-muted-foreground">Upload de arquivos vinculados ao processo. Os metadados são armazenados localmente.</p>
            {arquivos.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">Nenhum arquivo anexado</div>}
            {arquivos.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{a.nome}</p>
                  <p className="text-xs text-muted-foreground">{a.categoria} · {new Date(a.criadoEm).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Observações */}
        {tab === "observacoes" && (
          <div className="bg-card rounded-lg border shadow-card p-6 space-y-4">
            <h2 className="font-heading font-semibold text-foreground">Observações e Estratégia</h2>
            <div className="grid grid-cols-1 gap-4">
              {[
                { label: "Objeto da Ação", key: "objetoAcao" },
                { label: "Resumo do Caso", key: "resumoCaso" },
                { label: "Fundamentos", key: "fundamentos" },
                { label: "Estratégia", key: "estrategia" },
                { label: "Riscos", key: "riscos" },
                { label: "Observações Internas", key: "observacoes" },
                { label: "Andamento", key: "andamento" },
              ].map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">{f.label}</label>
                  <textarea value={form[f.key] || ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                </div>
              ))}
            </div>
            <Button onClick={handleSave}><Save className="h-4 w-4 mr-1" /> Salvar Observações</Button>
          </div>
        )}

        {/* Tab: Histórico */}
        {tab === "historico" && (
          <div className="bg-card rounded-lg border shadow-card p-6">
            <h2 className="font-heading font-semibold text-foreground mb-4">Histórico de Alterações</h2>
            {historico.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma alteração registrada</p>}
            <div className="relative">
              {historico.length > 0 && <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />}
              <div className="space-y-4">
                {historico.map((h) => (
                  <div key={h.id} className="relative pl-10">
                    <div className="absolute left-2.5 top-1.5 h-3 w-3 rounded-full bg-primary border-2 border-primary" />
                    <div className="p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <p className="text-sm font-medium text-foreground">{h.descricao}</p>
                      <p className="text-xs text-muted-foreground">{h.usuarioNome} · {new Date(h.data).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

function Fd({ label, value, disabled, onChange, type }: { label: string; value?: string; disabled: boolean; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-muted-foreground">{label}</label>
      <input type={type || "text"} value={value || ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-default" />
    </div>
  );
}

export default ProcessoDetalhe;
