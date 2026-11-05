import { AppLayout } from "@/components/AppLayout";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { db, addHistorico, parteComDocumento } from "@/lib/db";
import { erroDocumento, tipoDocumentoDe } from "@/lib/documentos";
import { SeletorTipoPessoa, CampoDocumento } from "@/components/PessoaCampos";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Building2, FolderOpen, CalendarDays, Clock, FileText, Edit, Save, X } from "lucide-react";
import type { ParteInteressada, VinculoProcessoParte, Processo, Evento, Prazo } from "@/types";
import { toast } from "sonner";
import { ESTADOS_CIVIS, TIPOS_PESSOA, UFS_BRASIL } from "@/types";

const ParteDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, permissoes } = useAuth();
  // Dados pessoais ocultos: chegam mascarados e não podem ser editados.
  const travaPessoal = !permissoes.verDadosPessoais;
  const [parte, setParte] = useState<ParteInteressada | null>(null);
  const [vinculos, setVinculos] = useState<(VinculoProcessoParte & { processo?: Processo })[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [prazos, setPrazos] = useState<Prazo[]>([]);
  const [tab, setTab] = useState("geral");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const formDe = (obj: object) =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => typeof v === "string") as [string, string][]);
  /** Descarta as alterações não salvas e volta aos dados gravados. */
  const cancelarEdicao = () => {
    if (parte) setForm(formDe(parte));
    setEditing(false);
  };

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    if (!id) return;
    const p = await db.partes.get(id);
    if (!p) { navigate("/partes"); return; }
    setParte(p);
    setForm(formDe(p));
    // Load vinculos with processes
    const vs = await db.vinculos.where("parteId").equals(id).toArray();
    const vWithProc = await Promise.all(vs.map(async (v) => {
      const proc = await db.processos.get(v.processoId);
      return { ...v, processo: proc };
    }));
    setVinculos(vWithProc);
    // Load events linked to this parte
    const allEvts = await db.eventos.toArray();
    setEventos(allEvts.filter((e) => e.partesIds?.includes(id)));
    // Load prazos from linked processes
    const procIds = vs.map((v) => v.processoId);
    const allPrazos = await db.prazos.toArray();
    setPrazos(allPrazos.filter((pr) => pr.processoId && procIds.includes(pr.processoId)));
  };

  const handleSave = async () => {
    if (!parte || !id) return;
    const pf = (form.tipoPessoa || parte.tipoPessoa) === "Pessoa Física";
    const nome = pf ? form.nome : (form.razaoSocial || form.nome);
    if (!nome?.trim()) { toast.error(pf ? "Preencha o nome completo" : "Preencha a razão social"); return; }
    // Com dados pessoais ocultos o documento vem mascarado: não valida (nem é enviado de volta).
    const erroDoc = travaPessoal ? null : erroDocumento(tipoDocumentoDe(form.tipoPessoa || parte.tipoPessoa), form.cpfCnpj);
    if (erroDoc) { toast.error(erroDoc); return; }
    const dup = form.cpfCnpj && !travaPessoal ? await parteComDocumento(form.cpfCnpj, id) : undefined;
    if (dup) { toast.error(`Este documento já está cadastrado para "${dup.nome || dup.razaoSocial}".`); return; }
    // Evita sobrescrever uma alteração feita em outra janela/usuário desde que a tela foi aberta.
    const atual = await db.partes.get(id);
    if (atual && atual.atualizadoEm !== parte.atualizadoEm) {
      toast.error("Esta parte foi alterada em outro lugar enquanto você editava. Recarregue para ver a versão atual antes de salvar.");
      return;
    }
    const { _docGuardado: _ignorar, ...dados } = form;
    const updated = {
      ...parte, ...dados,
      nome: pf ? form.nome : (form.razaoSocial || form.nome),
      atualizadoEm: new Date().toISOString(),
    } as ParteInteressada;
    await db.partes.put(updated);
    await addHistorico(id, "parte", "edicao", "Dados da parte atualizados", currentUser?.id || "", currentUser?.nome || "");
    setParte(updated);
    setEditing(false);
    toast.success("Dados salvos!");
  };

  if (!parte) return <AppLayout><div className="py-12 text-center text-muted-foreground">Carregando...</div></AppLayout>;

  const tabs = [
    { id: "geral", label: "Dados Gerais", icon: User },
    { id: "processos", label: `Processos (${vinculos.length})`, icon: FolderOpen },
    { id: "eventos", label: `Eventos (${eventos.length})`, icon: CalendarDays },
    { id: "prazos", label: `Prazos (${prazos.length})`, icon: Clock },
  ];

  const inputCls = "w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/partes")}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex items-center gap-3 flex-1">
            {parte.foto ? (
              <img src={parte.foto} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                {parte.tipoPessoa === "Pessoa Física" ? <User className="h-6 w-6 text-primary" /> : <Building2 className="h-6 w-6 text-primary" />}
              </div>
            )}
            <div>
              <h1 className="text-xl font-heading font-semibold text-foreground">{parte.nome || parte.razaoSocial}</h1>
              <p className="text-sm text-muted-foreground">{parte.tipoPessoa} · {parte.cpfCnpj || "Sem documento"}</p>
            </div>
          </div>
          <StatusBadge status={parte.status} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "geral" && (
          <div className="bg-card rounded-lg border shadow-card p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-heading font-semibold text-foreground">Informações</h2>
              {editing ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={cancelarEdicao}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
                  <Button size="sm" onClick={handleSave}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
                </div>
              ) : (
                permissoes.editarProcessos && <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Edit className="h-4 w-4 mr-1" /> Editar</Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {editing && !travaPessoal && (
                <div className="sm:col-span-2 lg:col-span-3 space-y-1.5">
                  <label className="text-sm text-muted-foreground">Tipo de Pessoa</label>
                  <SeletorTipoPessoa value={form.tipoPessoa || ""} onChange={(t) => {
                    // Documento do outro tipo não serve: guarda e devolve se o usuário voltar.
                    const mudouDoc = tipoDocumentoDe(t) !== tipoDocumentoDe(form.tipoPessoa || "");
                    setForm({
                      ...form, tipoPessoa: t,
                      ...(mudouDoc ? { cpfCnpj: form._docGuardado || "", _docGuardado: form.cpfCnpj || "" } : {}),
                    });
                  }} />
                </div>
              )}
              {form.tipoPessoa === "Pessoa Física" ? (
                <>
                  <Field label="Nome Completo" value={form.nome} disabled={!editing || travaPessoal} onChange={(v) => setForm({ ...form, nome: v })} />
                  <Field label="Nome Social" value={form.nomeSocial} disabled={!editing || travaPessoal} onChange={(v) => setForm({ ...form, nomeSocial: v })} />
                </>
              ) : (
                <>
                  <Field label="Razão Social" value={form.razaoSocial || form.nome} disabled={!editing || travaPessoal} onChange={(v) => setForm({ ...form, razaoSocial: v })} />
                  <Field label="Nome Fantasia" value={form.nomeFantasia} disabled={!editing} onChange={(v) => setForm({ ...form, nomeFantasia: v })} />
                </>
              )}
              <CampoDocumento tipo={tipoDocumentoDe(form.tipoPessoa || "")} value={form.cpfCnpj || ""} disabled={!editing || travaPessoal}
                onChange={(v) => setForm({ ...form, cpfCnpj: v })} />
              <Field label="Telefone" value={form.telefone} disabled={!editing || travaPessoal} onChange={(v) => setForm({ ...form, telefone: v })} />
              <Field label="Email" value={form.email} disabled={!editing || travaPessoal} onChange={(v) => setForm({ ...form, email: v })} />
              <Field label="Cidade" value={form.cidade} disabled={!editing} onChange={(v) => setForm({ ...form, cidade: v })} />
              <Field label="Estado" value={form.estado} disabled={!editing} onChange={(v) => setForm({ ...form, estado: v })} />
              <Field label="Endereço" value={form.endereco} disabled={!editing || travaPessoal} onChange={(v) => setForm({ ...form, endereco: v })} />
              <Field label="Profissão" value={form.profissao} disabled={!editing} onChange={(v) => setForm({ ...form, profissao: v })} />
              <Field label="Nacionalidade" value={form.nacionalidade} disabled={!editing} onChange={(v) => setForm({ ...form, nacionalidade: v })} />
            </div>
            {(form.observacoes || editing) && (
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Observações</label>
                <textarea value={form.observacoes || ""} disabled={!editing} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-50" />
              </div>
            )}
          </div>
        )}

        {tab === "processos" && (
          <div className="bg-card rounded-lg border shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Processo</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden md:table-cell">Número</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Papel</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
              </tr></thead>
              <tbody>
                {vinculos.map((v) => (
                  <tr key={v.id} className="border-t border-border hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <Link to={`/processos/${v.processoId}`} className="font-medium text-foreground hover:text-primary hover:underline">
                        {v.processo?.titulo || "Processo"}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-xs hidden md:table-cell">{v.processo?.numero || "—"}</td>
                    <td className="py-3 px-4 text-foreground">{v.tipoEnvolvimento}</td>
                    <td className="py-3 px-4">{v.processo && <StatusBadge status={v.processo.status} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {vinculos.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">Nenhum processo vinculado</div>}
          </div>
        )}

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
              </div>
            ))}
          </div>
        )}

        {tab === "prazos" && (
          <div className="bg-card rounded-lg border shadow-card p-5 space-y-3">
            {prazos.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">Nenhum prazo vinculado</div>}
            {prazos.map((p) => (
              <div key={p.id} className="flex items-start justify-between p-3 rounded-lg border border-border">
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 mt-0.5 text-warning flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.titulo}</p>
                    <p className="text-xs text-muted-foreground">{p.dataLimite}</p>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

function Field({ label, value, disabled, onChange }: { label: string; value?: string; disabled: boolean; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-muted-foreground">{label}</label>
      <input value={value || ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-default" />
    </div>
  );
}

export default ParteDetalhe;
