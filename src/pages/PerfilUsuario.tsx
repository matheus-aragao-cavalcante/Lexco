import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { User, Briefcase, Bell, Shield, Download, Upload, Save, Camera } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { ESTADOS_CIVIS, UFS_BRASIL } from "@/types";
import { backupFileName, createBackup, parseBackup, serializeBackup, type LexcoBackup } from "@/lib/backup";
import { RestaurarBackupDialog } from "@/components/RestaurarBackupDialog";
import { csvLinha } from "@/lib/csv";
import { formatarData, hojeISO } from "@/lib/dates";
import { GoogleDriveBackup } from "@/components/GoogleDriveBackup";

const tabs = [
  { id: "pessoal", label: "Dados Pessoais", icon: User },
  { id: "profissional", label: "Dados Profissionais", icon: Briefcase },
  { id: "preferencias", label: "Preferências", icon: Bell },
  { id: "seguranca", label: "Segurança", icon: Shield },
  { id: "exportar", label: "Importar/Exportar", icon: Download },
];

const PerfilUsuario = () => {
  const { currentUser, updateUser, podeGerenciarUsuarios } = useAuth();
  // ?aba=exportar abre direto na aba (link "Gerenciar" do botão de backup no topo)
  const { search } = useLocation();
  const [activeTab, setActiveTab] = useState(() => new URLSearchParams(search).get("aba") || "pessoal");
  useEffect(() => {
    const aba = new URLSearchParams(search).get("aba");
    if (aba) setActiveTab(aba);
  }, [search]);
  const [form, setForm] = useState<Record<string, string>>(() => {
    if (!currentUser) return {};
    return Object.fromEntries(Object.entries(currentUser).filter(([, v]) => typeof v === "string") as [string, string][]);
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [backupParaRestaurar, setBackupParaRestaurar] = useState<LexcoBackup | null>(null);
  const [backupOrigem, setBackupOrigem] = useState<string>();
  const [senhaForm, setSenhaForm] = useState({ atual: "", nova: "", confirmar: "" });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!currentUser) return;
    const updates: Record<string, unknown> = { ...form };
    delete updates.senha;
    delete updates.id;
    delete updates.contaGoogle;
    delete updates.nomeExibicao; // fica em preferencias (é de lá que Topbar/Dashboard leem)

    const nome = (form.nome || "").trim();
    const email = (form.email || "").trim().toLowerCase();
    if (!nome) { toast.error("Informe o nome"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("E-mail inválido"); return; }
    const outro = await db.users.where("email").equals(email).first();
    if (outro && outro.id !== currentUser.id) { toast.error("Este e-mail já é usado por outro usuário"); return; }

    const nomeExibicao = (form.nomeExibicao ?? currentUser.preferencias?.nomeExibicao ?? "").trim();
    await updateUser({
      ...(updates as Partial<typeof currentUser>),
      nome,
      email,
      preferencias: { ...currentUser.preferencias, nomeExibicao: nomeExibicao || undefined },
    });
    toast.success("Perfil salvo!");
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      set("foto", base64);
      updateUser({ foto: base64 });
      toast.success("Foto atualizada!");
    };
    reader.readAsDataURL(file);
  };

  const handleExportCSV = async (tipo: "tudo" | "processos" | "partes" | "eventos") => {
    const userId = currentUser?.id || "";
    let csv = "";
    if (tipo === "tudo" || tipo === "processos") {
      const processos = await db.processos.toArray();
      const myProcs = processos.filter((p) => p.criadoPor === userId || p.responsavelId === userId);
      csv += "=== PROCESSOS ===\n";
      csv += csvLinha(["ID", "Titulo", "Numero", "Area", "Status", "Prioridade", "DataCadastro"]);
      myProcs.forEach((p) => { csv += csvLinha([p.id, p.titulo, p.numero, p.areaDireito, p.status, p.prioridade, p.dataCadastro]); });
      csv += "\n";
    }
    if (tipo === "tudo" || tipo === "partes") {
      const partes = await db.partes.toArray();
      csv += "=== PARTES INTERESSADAS ===\n";
      csv += csvLinha(["ID", "Nome", "Tipo", "CPF_CNPJ", "Email", "Telefone", "Cidade", "Estado"]);
      partes.forEach((p) => { csv += csvLinha([p.id, p.nome || p.razaoSocial, p.tipoPessoa, p.cpfCnpj, p.email, p.telefone, p.cidade, p.estado]); });
      csv += "\n";
    }
    if (tipo === "tudo" || tipo === "eventos") {
      const eventos = await db.eventos.toArray();
      csv += "=== EVENTOS ===\n";
      csv += csvLinha(["ID", "Titulo", "Tipo", "Data", "HoraInicio", "Status"]);
      eventos.forEach((e) => { csv += csvLinha([e.id, e.titulo, e.tipo, formatarData(e.data), e.horaInicio, e.status]); });
    }
    // BOM: faz o Excel reconhecer UTF-8 (acentos)
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lexco_export_${tipo}_${hojeISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportação concluída!");
  };

  const handleExportJSON = async () => {
    if (!podeGerenciarUsuarios) return;
    try {
      const backup = await createBackup();
      const blob = new Blob([serializeBackup(backup)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = backupFileName();
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup exportado!");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao gerar o backup.");
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = ""; // permite escolher o mesmo arquivo de novo
    if (!file || !podeGerenciarUsuarios) return;
    try {
      setBackupOrigem(`arquivo ${file.name}`);
      setBackupParaRestaurar(parseBackup(await file.text()));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Arquivo inválido");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (currentUser.senha && !(await verifyPassword(senhaForm.atual, currentUser.senha))) {
      toast.error("Senha atual incorreta");
      return;
    }
    if (senhaForm.nova.length < 4) { toast.error("A nova senha deve ter no mínimo 4 caracteres"); return; }
    if (senhaForm.nova !== senhaForm.confirmar) { toast.error("As senhas não conferem"); return; }
    await updateUser({ senha: await hashPassword(senhaForm.nova) });
    setSenhaForm({ atual: "", nova: "", confirmar: "" });
    toast.success(currentUser.senha ? "Senha alterada!" : "Senha local definida!");
  };

  if (!currentUser) return null;

  const inputCls = "w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-foreground">Meu Perfil</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie seus dados pessoais e preferências</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <nav className="md:w-56 flex-shrink-0 space-y-1">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                  activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4" /> {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex-1 bg-card rounded-lg border shadow-card p-6 animate-fade-in">
            {activeTab === "pessoal" && (
              <div className="space-y-6">
                <h2 className="text-lg font-heading font-semibold text-foreground">Dados Pessoais</h2>
                <div className="flex items-center gap-4">
                  {currentUser.foto ? (
                    <img src={currentUser.foto} alt="" className="h-16 w-16 rounded-full object-cover" />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-7 w-7 text-primary" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-foreground">{currentUser.nome}</p>
                    <button onClick={() => fileRef.current?.click()} className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                      <Camera className="h-3 w-3" /> Alterar foto
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <F label="Nome" value={form.nome} onChange={(v) => set("nome", v)} />
                  <F label="Nome Social" value={form.nomeSocial} onChange={(v) => set("nomeSocial", v)} />
                  <F label="Email" value={form.email} onChange={(v) => set("email", v)} type="email" />
                  <F label="CPF" value={form.cpf} onChange={(v) => set("cpf", v)} />
                  <F label="RG" value={form.rg} onChange={(v) => set("rg", v)} />
                  <F label="Data de Nascimento" value={form.dataNascimento} onChange={(v) => set("dataNascimento", v)} type="date" />
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Estado Civil</label>
                    <select value={form.estadoCivil || ""} onChange={(e) => set("estadoCivil", e.target.value)} className={inputCls}>
                      <option value="">Selecionar</option>
                      {ESTADOS_CIVIS.map((ec) => <option key={ec} value={ec}>{ec}</option>)}
                    </select>
                  </div>
                  <F label="Telefone" value={form.telefone} onChange={(v) => set("telefone", v)} />
                  <F label="Endereço" value={form.endereco} onChange={(v) => set("endereco", v)} />
                  <F label="Cidade" value={form.cidade} onChange={(v) => set("cidade", v)} />
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Estado</label>
                    <select value={form.estado || ""} onChange={(e) => set("estado", e.target.value)} className={inputCls}>
                      <option value="">Selecionar</option>
                      {UFS_BRASIL.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                  <F label="CEP" value={form.cep} onChange={(v) => set("cep", v)} />
                </div>
                <Button onClick={handleSave}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
              </div>
            )}

            {activeTab === "profissional" && (
              <div className="space-y-6">
                <h2 className="text-lg font-heading font-semibold text-foreground">Dados Profissionais</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <F label="OAB" value={form.oab} onChange={(v) => set("oab", v)} />
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">UF da OAB</label>
                    <select value={form.ufOab || ""} onChange={(e) => set("ufOab", e.target.value)} className={inputCls}>
                      <option value="">Selecionar</option>
                      {UFS_BRASIL.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                  <F label="Cargo / Função" value={form.cargo} onChange={(v) => set("cargo", v)} />
                  <F label="Especialidade" value={form.especialidade} onChange={(v) => set("especialidade", v)} />
                  <F label="Área de Atuação" value={form.areaAtuacao} onChange={(v) => set("areaAtuacao", v)} />
                  <F label="Nome do Escritório" value={form.nomeEscritorio} onChange={(v) => set("nomeEscritorio", v)} />
                  <F label="CNPJ do Escritório" value={form.cnpjEscritorio} onChange={(v) => set("cnpjEscritorio", v)} />
                  <F label="Endereço Profissional" value={form.enderecoProf} onChange={(v) => set("enderecoProf", v)} />
                  <F label="Telefone Profissional" value={form.telProf} onChange={(v) => set("telProf", v)} />
                  <F label="Email Profissional" value={form.emailProf} onChange={(v) => set("emailProf", v)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Bio / Resumo Profissional</label>
                  <textarea value={form.bio || ""} onChange={(e) => set("bio", e.target.value)} rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Assinatura Digital (texto)</label>
                  <textarea value={form.assinaturaDigital || ""} onChange={(e) => set("assinaturaDigital", e.target.value)} rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                </div>
                <Button onClick={handleSave}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
              </div>
            )}

            {activeTab === "preferencias" && (
              <div className="space-y-6">
                <h2 className="text-lg font-heading font-semibold text-foreground">Preferências</h2>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <F label="Nome de Exibição" value={form.nomeExibicao ?? currentUser.preferencias?.nomeExibicao ?? ""} onChange={(v) => set("nomeExibicao", v)} />
                  </div>
                  <Button onClick={handleSave}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
                </div>
                <div className="space-y-4">
                  <p className="text-sm font-medium text-foreground">Notificações</p>
                  {[
                    { key: "notifPrazo1Dia", label: "Prazo vence em 1 dia" },
                    { key: "notifPrazoHoje", label: "Prazo vence hoje" },
                    { key: "notifAgenda", label: "Novos eventos na agenda" },
                    { key: "notifPendencias", label: "Pendências de documentos" },
                  ].map((n) => (
                    <div key={n.key} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <span className="text-sm text-foreground">{n.label}</span>
                      <div className={`h-6 w-11 rounded-full relative cursor-pointer transition-colors ${
                        (currentUser.preferencias as any)?.[n.key] !== false ? "bg-success" : "bg-muted"
                      }`} onClick={() => {
                        const newPrefs = { ...currentUser.preferencias, [n.key]: (currentUser.preferencias as any)?.[n.key] === false };
                        updateUser({ preferencias: newPrefs });
                      }}>
                        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow-sm transition-transform ${
                          (currentUser.preferencias as any)?.[n.key] !== false ? "translate-x-5" : "translate-x-0.5"
                        }`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "seguranca" && (
              <div className="space-y-6">
                <h2 className="text-lg font-heading font-semibold text-foreground">Segurança</h2>
                <div className="p-4 rounded-lg border border-border space-y-2">
                  <p className="text-sm font-medium text-foreground">Sessão Local Ativa</p>
                  <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                  <p className="text-xs text-success">Conectado</p>
                  {currentUser.contaGoogle && (
                    <p className="text-xs text-muted-foreground">Vinculada à conta Google {currentUser.contaGoogle}</p>
                  )}
                </div>
                <form onSubmit={handlePasswordChange} className="space-y-3 max-w-sm">
                  <h3 className="text-sm font-medium text-foreground">{currentUser.senha ? "Alterar senha" : "Definir senha local"}</h3>
                  {!currentUser.senha && (
                    <p className="text-xs text-muted-foreground">
                      Você entra pelo Google. Defina uma senha se quiser entrar também sem a conta Google.
                    </p>
                  )}
                  {currentUser.senha && (
                    <input type="password" placeholder="Senha atual" value={senhaForm.atual} onChange={(e) => setSenhaForm((f) => ({ ...f, atual: e.target.value }))} className={inputCls} autoComplete="current-password" />
                  )}
                  <input type="password" placeholder="Nova senha (mín. 4 caracteres)" value={senhaForm.nova} onChange={(e) => setSenhaForm((f) => ({ ...f, nova: e.target.value }))} className={inputCls} autoComplete="new-password" />
                  <input type="password" placeholder="Confirmar nova senha" value={senhaForm.confirmar} onChange={(e) => setSenhaForm((f) => ({ ...f, confirmar: e.target.value }))} className={inputCls} autoComplete="new-password" />
                  <Button type="submit" variant="outline">{currentUser.senha ? "Alterar senha" : "Definir senha"}</Button>
                </form>
              </div>
            )}

            {activeTab === "exportar" && (
              <div className="space-y-6">
                <h2 className="text-lg font-heading font-semibold text-foreground">Importar / Exportar</h2>
                {podeGerenciarUsuarios ? (
                  <GoogleDriveBackup
                    onRestore={(backup, origem) => {
                      setBackupOrigem(origem);
                      setBackupParaRestaurar(backup);
                    }}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Backup completo e restauração (arquivo ou Google Drive) ficam disponíveis apenas para administradores,
                    pois incluem os dados de todos os usuários.
                  </p>
                )}
                <hr className="border-border" />
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-foreground">Exportar CSV</h3>
                  <p className="text-xs text-muted-foreground">Fotos e arquivos anexados não são incluídos no CSV, apenas metadados textuais.</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => handleExportCSV("tudo")}><Download className="h-4 w-4 mr-1" /> Exportar Tudo</Button>
                    <Button size="sm" variant="outline" onClick={() => handleExportCSV("processos")}>Processos</Button>
                    <Button size="sm" variant="outline" onClick={() => handleExportCSV("partes")}>Partes</Button>
                    <Button size="sm" variant="outline" onClick={() => handleExportCSV("eventos")}>Eventos</Button>
                  </div>
                </div>
                {podeGerenciarUsuarios && (<>
                <hr className="border-border" />
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-foreground">Backup JSON Completo</h3>
                  <p className="text-xs text-muted-foreground">Inclui todos os dados, usuários e anexos. Use para guardar uma cópia ou levar o sistema para outro computador.</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleExportJSON}><Download className="h-4 w-4 mr-1" /> Exportar JSON</Button>
                    <label className="inline-flex">
                      <Button size="sm" variant="outline" asChild><span><Upload className="h-4 w-4 mr-1" /> Importar JSON</span></Button>
                      <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                    </label>
                  </div>
                </div>
                </>)}
              </div>
            )}
          </div>
        </div>
      </div>
      <RestaurarBackupDialog
        backup={backupParaRestaurar}
        origem={backupOrigem}
        onOpenChange={(open) => !open && setBackupParaRestaurar(null)}
      />
    </AppLayout>
  );
};

function F({ label, value, onChange, type }: { label: string; value?: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-muted-foreground">{label}</label>
      <input type={type || "text"} value={value || ""} onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}

export default PerfilUsuario;
