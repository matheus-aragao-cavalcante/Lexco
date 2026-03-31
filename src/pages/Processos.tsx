import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Search, Eye, Edit, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { NovoProcessoDialog } from "@/components/NovoProcessoDialog";
import { db } from "@/lib/db";
import type { Processo } from "@/types";
import { toast } from "sonner";
import { FolderOpen } from "lucide-react";

const Processos = () => {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const load = async () => { setProcessos(await db.processos.toArray()); };
  useEffect(() => { load(); }, []);

  const filtered = processos.filter((p) => {
    const matchesStatus = statusFilter === "todos" || p.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch = !search || p.titulo.toLowerCase().includes(q) || (p.numero || "").includes(q) || (p.areaDireito || "").toLowerCase().includes(q) || (p.tribunal || "").toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este processo?")) return;
    await db.processos.delete(id);
    await db.vinculos.where("processoId").equals(id).delete();
    await db.prazos.where("processoId").equals(id).delete();
    toast.success("Processo excluído");
    load();
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-foreground">Processos</h1>
            <p className="text-muted-foreground text-sm mt-1">Gerencie todos os processos · {processos.length} total</p>
          </div>
          <NovoProcessoDialog onSaved={load} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, número, área, tribunal..."
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex gap-2">
            {["todos", "ativo", "pendente", "concluido", "arquivado"].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/30"}`}>
                {s === "todos" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-lg border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Processo</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden lg:table-cell">Número</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden md:table-cell">Área</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden xl:table-cell">Tribunal</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Ações</th>
              </tr></thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <Link to={`/processos/${p.id}`} className="font-medium text-foreground hover:text-primary hover:underline">{p.titulo}</Link>
                      <p className="text-xs text-muted-foreground lg:hidden">{p.numero}</p>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-xs hidden lg:table-cell">{p.numero || "—"}</td>
                    <td className="py-3 px-4 text-foreground hidden md:table-cell">{p.areaDireito || "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden xl:table-cell">{p.tribunal || "—"}</td>
                    <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/processos/${p.id}`)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
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

export default Processos;
