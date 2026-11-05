import { Search, ChevronDown, LogOut, UserCircle, ArrowLeftRight, Building2, Home, KeyRound } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { BackupStatusButton } from "@/components/BackupStatusButton";
import { SearchDialog } from "@/components/SearchDialog";
import { useAuth } from "@/contexts/AuthContext";
import { EntrarAmbienteDialog } from "@/components/EntrarAmbienteDialog";
import { getDesktopGoogle } from "@/lib/googleDrive";

export function Topbar() {
  const [showMenu, setShowMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { currentUser, logout, switchUser, ambiente, ambientesDisponiveis, entrarAmbiente } = useAuth();
  const [entrarOpen, setEntrarOpen] = useState(false);
  const navigate = useNavigate();

  const initials = currentUser?.nome
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("") || "U";

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full cursor-pointer" onClick={() => setSearchOpen(true)}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <div className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-sm text-muted-foreground flex items-center">
            Buscar processos, prazos, partes...
          </div>
        </div>
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <EntrarAmbienteDialog open={entrarOpen} onOpenChange={setEntrarOpen} />

      <div className="flex items-center gap-3">
        <BackupStatusButton />
        <NotificationsPanel />

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors"
          >
            {currentUser?.foto ? (
              <img src={currentUser.foto} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-semibold text-primary">{initials}</span>
              </div>
            )}
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-foreground">{currentUser?.preferencias?.nomeExibicao || currentUser?.nome}</p>
              <p className="text-xs text-muted-foreground capitalize">{currentUser?.perfil}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-60 bg-card border border-border rounded-lg shadow-elevated z-50 py-1">
                <button
                  onClick={() => { setShowMenu(false); navigate("/perfil"); }}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors w-full text-left text-foreground"
                >
                  <UserCircle className="h-4 w-4" /> Meu Perfil
                </button>
                <button
                  onClick={() => { setShowMenu(false); switchUser(); }}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors w-full text-left text-foreground"
                >
                  <ArrowLeftRight className="h-4 w-4" /> Trocar Usuário
                </button>
                {getDesktopGoogle() && (
                  <>
                    <hr className="my-1 border-border" />
                    <p className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Ambiente</p>
                    <button onClick={() => { setShowMenu(false); entrarAmbiente(null); }}
                      className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors w-full text-left ${!ambiente ? "text-primary font-medium" : "text-foreground"}`}>
                      <Home className="h-4 w-4" /> Meu ambiente
                    </button>
                    {ambientesDisponiveis.map((a) => (
                      <button key={a.id} onClick={() => { setShowMenu(false); entrarAmbiente(a.id); }}
                        className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors w-full text-left ${ambiente?.id === a.id ? "text-primary font-medium" : "text-foreground"}`}>
                        <Building2 className="h-4 w-4 shrink-0" /> <span className="truncate">{a.donoNome}</span>
                      </button>
                    ))}
                    <button onClick={() => { setShowMenu(false); setEntrarOpen(true); }}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors w-full text-left text-foreground">
                      <KeyRound className="h-4 w-4" /> Tenho um código de convite
                    </button>
                  </>
                )}
                <hr className="my-1 border-border" />
                <button
                  onClick={() => { setShowMenu(false); logout(); }}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors w-full text-left text-destructive"
                >
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
