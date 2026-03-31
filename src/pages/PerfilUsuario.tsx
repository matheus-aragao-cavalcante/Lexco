import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { User, Briefcase, Bell, Shield, Download, Upload, Save, Camera } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ESTADOS_CIVIS, UFS_BRASIL } from "@/types";

const tabs = [
  { id: "pessoal", label: "Dados Pessoais", icon: User },
  { id: "profissional", label: "Dados Profissionais", icon: Briefcase },
  { id: "preferencias", label: "Preferências", icon: Bell },
  { id: "seguranca", label: "Segurança", icon: Shield },
  { id: "exportar", label: "Importar/Exportar", icon: Download },
];

const PerfilUsuario = () => {
  const { currentUser, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState("pessoal");
  const [form, setForm] = useState<Record<string, string>>(() => {
    if (!currentUser) return {};
    return Object.fromEntries(Object.entries(currentUser).filter(([, v]) => typeof v === "string") as [string, string][]);
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!currentUser) return;
    const updates: any = { ...form };
    delete updates.senha;
    delete updates.id;
    await updateUser(updates);
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
      csv += "ID,Titulo,Numero,Area,Status,Prioridade,DataCadastro\n";
      myProcs.forEach((p) => { csv += `"${p.id}","${p.titulo}","${p.numero || ""}","${p.areaDireito || ""}","${p.status}","${p.prioridade || ""}","${p.dataCadastro}"\n`; });
      csv += "\n";
    }
    if (tipo === "tudo" || tipo === "partes") {
      const partes = await db.partes.toArray();
      csv += "=== PARTES INTERESSADAS ===\n";
      csv += "ID,Nome,Tipo,CPF_CNPJ,Email,Telefone,Cidade,Estado\n";
      partes.forEach((p) => { csv += `"${p.id}","${p.nome || p.razaoSocial}","${p.tipoPessoa}","${p.cpfCnpj || ""}","${p.email || ""}","${p.telefone || ""}","${p.cidade || ""}","${p.estado || ""}"\n`; });
      csv += "\n";
    }
    if (tipo === "tudo" || tipo === "eventos") {
      const eventos = await db.eventos.toArray();
      csv += "=== EVENTOS ===\n";
      csv += "ID,Titulo,Tipo,Data,HoraInicio,Status\n";
      eventos.forEach((e) => { csv += `"${e.id}","${e.titulo}","${e.tipo}","${e.data}","${e.horaInicio || ""}","${e.status}"\n`; });
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lexcontrol_export_${tipo}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportação concluída!");
  };

  const handleExportJSON = async () => {
    const data = {
      user: currentUser,
      processos: await db.processos.toArray(),
      partes: await db.partes.toArray(),
      vinculos: await db.vinculos.toArray(),
      eventos: await db.eventos.toArray(),
      prazos: await db.prazos.toArray(),
      arquivos: (await db.arquivos.toArray()).map((a) => ({ ...a, dados: undefined })),
      historico: await db.historico.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lexcontrol_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup exportado!");
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.processos) await db.processos.bulkPut(data.processos);
        if (data.partes) await db.partes.bulkPut(data.partes);
        if (data.vinculos) await db.vinculos.bulkPut(data.vinculos);
        if (data.eventos) await db.eventos.bulkPut(data.eventos);
        if (data.prazos) await db.prazos.bulkPut(data.prazos);
        if (data.historico) await db.historico.bulkPut(data.historico);
        toast.success("Dados importados com sucesso!");
      } catch {
        toast.error("Arquivo inválido");
      }
    };
    reader.readAsText(file);
  };

  const handlePasswordChange = async () => {
    const newPass = prompt("Digite a nova senha (mínimo 4 caracteres):");
    if (!newPass || newPass.length < 4) { toast.error("Senha inválida"); return; }
    const hashed = await hashPassword(newPass);
    await updateUser({ senha: hashed } as any);
    toast.success("Senha alterada!");
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
                <F label="Nome de Exibição" value={form.nomeExibicao || currentUser.preferencias?.nomeExibicao || ""} onChange={(v) => set("nomeExibicao", v)} />
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
                </div>
                <Button variant="outline" onClick={handlePasswordChange}>Alterar Senha</Button>
              </div>
            )}

            {activeTab === "exportar" && (
              <div className="space-y-6">
                <h2 className="text-lg font-heading font-semibold text-foreground">Importar / Exportar</h2>
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
                <hr className="border-border" />
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-foreground">Backup JSON Completo</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleExportJSON}><Download className="h-4 w-4 mr-1" /> Exportar JSON</Button>
                    <label className="inline-flex">
                      <Button size="sm" variant="outline" asChild><span><Upload className="h-4 w-4 mr-1" /> Importar JSON</span></Button>
                      <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
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
