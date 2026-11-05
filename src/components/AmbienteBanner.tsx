import { Building2, RefreshCw, LogOut, Sparkles, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCompartilhamento } from "@/contexts/CompartilhamentoContext";
import { recarregarTelas } from "@/lib/telas";

/** Faixa no topo: em qual ambiente o usuário está e se chegaram dados novos. */
export function AmbienteBanner() {
  const { ambiente, entrarAmbiente } = useAuth();
  const { sincronizando, ultimaSync, novidades, pendentes, erro, sincronizarAgora, marcarVisto, papel } = useCompartilhamento();

  return (
    <>
      {ambiente && (
        <div className="bg-primary/10 border-b border-primary/20 px-6 py-2 flex items-center gap-3 text-sm flex-wrap">
          <Building2 className="h-4 w-4 text-primary shrink-0" />
          <span className="text-foreground">
            Ambiente compartilhado de <strong>{ambiente.donoNome}</strong> — você entra como {ambiente.voceNome}
          </span>
          <span className="text-xs text-muted-foreground">
            {sincronizando ? "sincronizando..." : ultimaSync ? `sincronizado às ${new Date(ultimaSync).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "aguardando a primeira sincronização"}
            {pendentes > 0 && ` · ${pendentes} alteração(ões) sua(s) aguardando o administrador`}
          </span>
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" onClick={sincronizarAgora} disabled={sincronizando}><RefreshCw className={`h-3.5 w-3.5 mr-1 ${sincronizando ? "animate-spin" : ""}`} /> Sincronizar</Button>
            <Button size="sm" variant="ghost" onClick={() => entrarAmbiente(null)}><LogOut className="h-3.5 w-3.5 mr-1" /> Meu ambiente</Button>
          </div>
        </div>
      )}
      {ambiente && erro && (
        <div className="bg-warning/10 border-b border-warning/30 px-6 py-1.5 text-xs text-foreground flex items-center gap-2">
          <CloudOff className="h-3.5 w-3.5 text-warning" /> {erro}
        </div>
      )}
      {novidades && papel !== "nenhum" && (
        <div className="bg-warning/10 border-b border-warning/30 px-6 py-2 flex items-center gap-3 text-sm">
          <Sparkles className="h-4 w-4 text-warning" />
          <span className="text-foreground">{novidades}.</span>
          <Button size="sm" className="ml-auto" onClick={() => { marcarVisto(); recarregarTelas(); }}>Atualizar a tela</Button>
          <Button size="sm" variant="ghost" onClick={marcarVisto}>Depois</Button>
        </div>
      )}
    </>
  );
}
