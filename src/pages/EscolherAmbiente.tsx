import { useState } from "react";
import { Building2, Home, Plus, LogOut, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { EntrarAmbienteDialog } from "@/components/EntrarAmbienteDialog";
import { EDICAO } from "@/lib/edicao";

/** Tela exibida após o login quando o usuário tem acesso a ambientes de outros administradores. */
export default function EscolherAmbiente() {
  const { usuarioLocal, ambientesDisponiveis, entrarAmbiente, logout } = useAuth();
  const [entrarOpen, setEntrarOpen] = useState(false);

  const Cartao = ({ icone: Icone, titulo, sub, onClick }: { icone: typeof Home; titulo: string; sub: string; onClick: () => void }) => (
    <button onClick={onClick}
      className="w-full flex items-center gap-4 rounded-lg border border-border bg-card p-4 text-left hover:border-primary hover:bg-primary/5 transition-colors">
      <span className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Icone className="h-5 w-5" /></span>
      <span>
        <span className="block font-medium text-foreground">{titulo}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
    </button>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-heading font-semibold text-foreground">Olá, {usuarioLocal?.nome?.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground mt-1">Em qual ambiente do {EDICAO.nomeApp} você quer trabalhar?</p>
        </div>
        <div className="space-y-3">
          <Cartao icone={Home} titulo="Meu ambiente" sub="Seus processos e backups, no seu Google Drive" onClick={() => entrarAmbiente(null)} />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Compartilhados com você</p>
          {ambientesDisponiveis.map((a) => (
            <Cartao key={a.id} icone={Building2} titulo={a.donoNome}
              sub={`Você entra como ${a.voceNome}${a.ultimaSync ? ` · sincronizado em ${new Date(a.ultimaSync).toLocaleString("pt-BR")}` : ""}`}
              onClick={() => entrarAmbiente(a.id)} />
          ))}
        </div>
        <div className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={logout}><LogOut className="h-4 w-4 mr-1" /> Sair</Button>
          <Button variant="outline" size="sm" onClick={() => setEntrarOpen(true)}><Plus className="h-4 w-4 mr-1" /> Tenho um código de convite</Button>
        </div>
      </div>
      <EntrarAmbienteDialog open={entrarOpen} onOpenChange={setEntrarOpen} />
    </div>
  );
}
