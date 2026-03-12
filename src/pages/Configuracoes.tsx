import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { User, Bell, Palette, Building2, ShieldCheck, Puzzle } from "lucide-react";
import { useState, useEffect } from "react";

const tabs = [
  { id: "perfil", label: "Perfil", icon: User },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "aparencia", label: "Aparência", icon: Palette },
  { id: "organizacao", label: "Organização", icon: Building2 },
  { id: "seguranca", label: "Segurança", icon: ShieldCheck },
  { id: "integracoes", label: "Integrações", icon: Puzzle },
];

const Configuracoes = () => {
  const [activeTab, setActiveTab] = useState("perfil");

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-foreground">Configurações</h1>
          <p className="text-muted-foreground text-sm mt-1">Preferências do sistema e do usuário</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar tabs */}
          <nav className="md:w-56 flex-shrink-0 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 bg-card rounded-lg border shadow-card p-6 animate-fade-in">
            {activeTab === "perfil" && (
              <div className="space-y-6">
                <h2 className="text-lg font-heading font-semibold text-foreground">Perfil</h2>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Dr. Carlos Silva</p>
                    <p className="text-sm text-muted-foreground">silva@lexcontrol.com</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Nome", value: "Dr. Carlos Silva" },
                    { label: "Email", value: "silva@lexcontrol.com" },
                    { label: "Cargo", value: "Advogado Sênior" },
                    { label: "OAB", value: "123.456/SP" },
                  ].map((field) => (
                    <div key={field.label} className="space-y-1.5">
                      <label className="text-sm text-muted-foreground">{field.label}</label>
                      <input
                        defaultValue={field.value}
                        className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  ))}
                </div>
                <Button>Salvar Alterações</Button>
              </div>
            )}

            {activeTab === "notificacoes" && (
              <div className="space-y-6">
                <h2 className="text-lg font-heading font-semibold text-foreground">Notificações</h2>
                {[
                  { label: "Prazo vence em 1 dia", desc: "Receber alerta um dia antes do vencimento", enabled: true },
                  { label: "Prazo vence hoje", desc: "Receber alerta no dia do vencimento", enabled: true },
                  { label: "Novos eventos na agenda", desc: "Alertar sobre novos compromissos", enabled: false },
                  { label: "Pendências de documentos", desc: "Lembrar de documentos pendentes", enabled: true },
                ].map((notif) => (
                  <div key={notif.label} className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">{notif.label}</p>
                      <p className="text-xs text-muted-foreground">{notif.desc}</p>
                    </div>
                    <div className={`h-6 w-11 rounded-full relative cursor-pointer transition-colors ${notif.enabled ? "bg-success" : "bg-muted"}`}>
                      <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow-sm transition-transform ${notif.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "aparencia" && (
              <div className="space-y-6">
                <h2 className="text-lg font-heading font-semibold text-foreground">Aparência</h2>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Tema da interface</p>
                  <div className="flex gap-3">
                    <div className="p-4 rounded-lg border-2 border-primary bg-card cursor-pointer text-center">
                      <div className="h-8 w-16 rounded bg-background border mb-2 mx-auto" />
                      <span className="text-xs font-medium text-foreground">Claro</span>
                    </div>
                    <div className="p-4 rounded-lg border border-border bg-card cursor-pointer text-center opacity-50">
                      <div className="h-8 w-16 rounded bg-foreground mb-2 mx-auto" />
                      <span className="text-xs font-medium text-muted-foreground">Escuro</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">Cores do sistema</p>
                  <div className="flex gap-3">
                    <div className="flex items-center gap-2 p-3 rounded-lg border border-border">
                      <div className="h-6 w-6 rounded-full bg-primary" />
                      <span className="text-sm text-foreground">Laranja Principal</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg border border-border">
                      <div className="h-6 w-6 rounded-full bg-success" />
                      <span className="text-sm text-foreground">Verde Sucesso</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "organizacao" && (
              <div className="space-y-6">
                <h2 className="text-lg font-heading font-semibold text-foreground">Organização</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Nome do Escritório", value: "LexControl Advocacia" },
                    { label: "CNPJ", value: "12.345.678/0001-90" },
                    { label: "Endereço", value: "Av. Paulista, 1000" },
                    { label: "Telefone", value: "(11) 3000-0000" },
                  ].map((field) => (
                    <div key={field.label} className="space-y-1.5">
                      <label className="text-sm text-muted-foreground">{field.label}</label>
                      <input
                        defaultValue={field.value}
                        className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  ))}
                </div>
                <Button>Salvar</Button>
              </div>
            )}

            {activeTab === "seguranca" && (
              <div className="space-y-6">
                <h2 className="text-lg font-heading font-semibold text-foreground">Segurança</h2>
                <div className="p-4 rounded-lg border border-border space-y-2">
                  <p className="text-sm font-medium text-foreground">Sessão Ativa</p>
                  <p className="text-xs text-muted-foreground">Chrome · macOS · São Paulo, BR</p>
                  <p className="text-xs text-success">Conectado agora</p>
                </div>
                <Button variant="destructive">Encerrar Todas as Sessões</Button>
              </div>
            )}

            {activeTab === "integracoes" && (
              <div className="space-y-6">
                <h2 className="text-lg font-heading font-semibold text-foreground">Integrações</h2>
                <p className="text-sm text-muted-foreground">Funcionalidades disponíveis em breve.</p>
                {[
                  { nome: "Google Agenda", desc: "Sincronize eventos e compromissos", em_breve: true },
                  { nome: "Email", desc: "Integração com cliente de email", em_breve: true },
                  { nome: "Geração de PDF", desc: "Exporte documentos e relatórios", em_breve: true },
                ].map((item) => (
                  <div key={item.nome} className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.nome}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <span className="text-xs bg-muted text-muted-foreground rounded-full px-2.5 py-1">Em breve</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Configuracoes;
