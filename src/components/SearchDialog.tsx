import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, FolderOpen, Clock, CalendarDays, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const searchItems = [
  { tipo: "processo", titulo: "Silva vs. Santos Ltda", desc: "0001234-56.2024.8.26.0100", icon: FolderOpen, url: "/processos" },
  { tipo: "processo", titulo: "Empresa ABC vs. Estado de SP", desc: "0005678-90.2024.8.26.0050", icon: FolderOpen, url: "/processos" },
  { tipo: "processo", titulo: "Caso Pereira - Trabalhista", desc: "0009012-34.2024.8.26.0200", icon: FolderOpen, url: "/processos" },
  { tipo: "prazo", titulo: "Contestação - Silva vs Santos", desc: "Vence hoje", icon: Clock, url: "/prazos" },
  { tipo: "prazo", titulo: "Recurso de Apelação", desc: "Vence hoje", icon: Clock, url: "/prazos" },
  { tipo: "evento", titulo: "Audiência - Caso Silva", desc: "09:00 - 12/03", icon: CalendarDays, url: "/agenda" },
  { tipo: "usuario", titulo: "Dr. Carlos Oliveira", desc: "oliveira@lexcontrol.com", icon: Users, url: "/usuarios" },
  { tipo: "usuario", titulo: "Dra. Ana Costa", desc: "costa@lexcontrol.com", icon: Users, url: "/usuarios" },
  { tipo: "processo", titulo: "Herança Família Martins", desc: "0003456-78.2024.8.26.0300", icon: FolderOpen, url: "/processos" },
  { tipo: "processo", titulo: "Defesa Criminal - Rodrigues", desc: "0007890-12.2024.8.26.0400", icon: FolderOpen, url: "/processos" },
];

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const results = query.length > 0
    ? searchItems.filter((item) =>
        item.titulo.toLowerCase().includes(query.toLowerCase()) ||
        item.desc.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  const handleSelect = (url: string) => {
    navigate(url);
    onOpenChange(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0">
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar processos, prazos, clientes..."
            className="flex-1 h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            autoFocus
          />
        </div>
        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto py-2">
            {results.map((item, i) => (
              <button
                key={i}
                onClick={() => handleSelect(item.url)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
              >
                <item.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.titulo}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <span className="text-[10px] uppercase text-muted-foreground bg-muted rounded px-1.5 py-0.5">{item.tipo}</span>
              </button>
            ))}
          </div>
        )}
        {query.length > 0 && results.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhum resultado encontrado</div>
        )}
        {query.length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">Digite para buscar processos, prazos, clientes...</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
