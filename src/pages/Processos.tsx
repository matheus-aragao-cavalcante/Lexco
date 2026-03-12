import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, Eye, Edit, CheckCircle2, Archive, Trash2 } from "lucide-react";
import { useState } from "react";

const processos = [
  { id: 1, nome: "Silva vs. Santos Ltda", numero: "0001234-56.2024.8.26.0100", cliente: "João Silva", partes: "Silva / Santos Ltda", responsavel: "Dr. Oliveira", status: "ativo" as const, tribunal: "TJSP", atualizado: "12/03/2026" },
  { id: 2, nome: "Empresa ABC vs. Estado de SP", numero: "0005678-90.2024.8.26.0050", cliente: "Empresa ABC", partes: "ABC / Estado SP", responsavel: "Dra. Costa", status: "pendente" as const, tribunal: "TRF3", atualizado: "11/03/2026" },
  { id: 3, nome: "Caso Pereira - Trabalhista", numero: "0009012-34.2024.8.26.0200", cliente: "Maria Pereira", partes: "Pereira / Indústria XYZ", responsavel: "Dr. Silva", status: "concluido" as const, tribunal: "TRT2", atualizado: "10/03/2026" },
  { id: 4, nome: "Herança Família Martins", numero: "0003456-78.2024.8.26.0300", cliente: "Carlos Martins", partes: "Herdeiros Martins", responsavel: "Dra. Lima", status: "ativo" as const, tribunal: "TJSP", atualizado: "09/03/2026" },
  { id: 5, nome: "Defesa Criminal - Rodrigues", numero: "0007890-12.2024.8.26.0400", cliente: "Pedro Rodrigues", partes: "MP / Rodrigues", responsavel: "Dr. Oliveira", status: "pendente" as const, tribunal: "TJSP", atualizado: "08/03/2026" },
  { id: 6, nome: "Revisão Contratual Omega", numero: "0002345-67.2024.8.26.0150", cliente: "Omega Tech", partes: "Omega / Beta Corp", responsavel: "Dra. Costa", status: "ativo" as const, tribunal: "TJSP", atualizado: "07/03/2026" },
];

const Processos = () => {
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");

  const filtered = processos.filter((p) => {
    const matchesStatus = statusFilter === "todos" || p.status === statusFilter;
    const matchesSearch = search === "" || p.nome.toLowerCase().includes(search.toLowerCase()) || p.numero.includes(search) || p.cliente.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-foreground">Processos</h1>
            <p className="text-muted-foreground text-sm mt-1">Gerencie todos os processos do escritório</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Novo Processo
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, número ou cliente..."
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            {["todos", "ativo", "pendente", "concluido"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/30"
                }`}
              >
                {s === "todos" ? "Todos" : s === "ativo" ? "Ativos" : s === "pendente" ? "Pendentes" : "Concluídos"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Processo</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden lg:table-cell">Número</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Cliente</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden md:table-cell">Responsável</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden xl:table-cell">Tribunal</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-foreground">{p.nome}</p>
                        <p className="text-xs text-muted-foreground lg:hidden">{p.numero}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-xs hidden lg:table-cell">{p.numero}</td>
                    <td className="py-3 px-4 text-foreground">{p.cliente}</td>
                    <td className="py-3 px-4 text-foreground hidden md:table-cell">{p.responsavel}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden xl:table-cell">{p.tribunal}</td>
                    <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum processo encontrado</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

const FolderOpen = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" /></svg>
);

export default Processos;
