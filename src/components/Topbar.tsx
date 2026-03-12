import { Search, ChevronDown, User, LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { SearchDialog } from "@/components/SearchDialog";

export function Topbar() {
  const [showMenu, setShowMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full cursor-pointer" onClick={() => setSearchOpen(true)}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <div className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-sm text-muted-foreground flex items-center">
            Buscar processos, prazos, clientes...
          </div>
        </div>
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      <div className="flex items-center gap-3">
        <NotificationsPanel />

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors"
          >
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-foreground">Dr. Silva</p>
              <p className="text-xs text-muted-foreground">Administrador</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-elevated z-50 py-1">
                <a href="/configuracoes" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground">
                  <Settings className="h-4 w-4" /> Configurações
                </a>
                <button className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors w-full text-left text-destructive">
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
