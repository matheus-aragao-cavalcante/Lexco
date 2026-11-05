import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Search, Eye, Trash2, FolderOpen } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { NovoProcessoDialog } from "@/components/NovoProcessoDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { db, deleteProcessoCascata, contarDependenciasProcesso, addHistorico } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import type { Processo } from "@/types";
import { toast } from "sonner";
import { EDICAO } from "@/lib/edicao";

const Processos = () => {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [confirmDel, setConfirmDel] = useState<{ id: string; titulo: string; deps: string } | null>(null);
  const navigate = useNavigate();
  const { currentUser, permissoes } = useAuth();

  const load = async () => { setProcessos(await db.processos.toArray()); };
  useEffect(() => { load(); }, []);

  const filtered = processos.filter((p) => {
    const matchesStatus = statusFilter === "todos" || p.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch = !search || p.titulo.toLowerCase().includes(q) || (p.numero || "").includes(q) || (p.areaDireito || "").toLowerCase().includes(q) || (p.tribunal || "").toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const askDelete = async (p: Processo) => {
    const d = await contarDependenciasProcesso(p.id);
    const parts: string[] = [];
    if (d.prazos) parts.push(`${d.prazos} prazo(s)`);
    if (d.eventos) parts.push(`${d.eventos} evento(s)`);
    if (d.arquivos) parts.push(`${d.arquivos} arquivo(s)`);
    if (d.vinculos) parts.push(`${d.vinculos} vínculo(s) com partes`);
    if (d.historico) parts.push(`${d.historico} entrada(s) de histórico`);
    setConfirmDel({
      id: p.id, titulo: p.titulo,
      deps: parts.length ? `Serão removidos também: ${parts.join(", ")}.` : "Nenhum dado vinculado será afetado.",
    });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDel) return;
    await deleteProcessoCascata(confirmDel.id);
    await addHistorico(confirmDel.id, "processo", "exclusao",
      `Processo "${confirmDel.titulo}" excluído (cascata)`,
      currentUser?.id || "", currentUser?.nome || "");
    toast.success("Processo e dados vinculados excluídos");
    setConfirmDel(null);
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
          {permissoes.cadastrarProcessos && <NovoProcessoDialog onSaved={load} />}
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
                <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden xl:table-cell">{EDICAO.edicao === "spu" ? "Órgão" : "Tribunal / Órgão"}</th>
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => askDelete(p)}><Trash2 className="h-4 w-4" /></Button>
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

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(null)}
        title={`Excluir processo "${confirmDel?.titulo}"?`}
        description={`Esta ação é irreversível.\n\n${confirmDel?.deps || ""}`}
        confirmLabel="Excluir tudo"
        onConfirm={handleConfirmDelete}
      />
    </AppLayout>
  );
};

export default Processos;
