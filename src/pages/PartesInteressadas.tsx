import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Search, Eye, Edit, Trash2, Plus, UsersRound, Building2, User } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db, excluirParte, podeExcluirParte } from "@/lib/db";
import { NovaParteDialog } from "@/components/NovaParteDialog";
import type { ParteInteressada } from "@/types";
import { toast } from "sonner";

const PartesInteressadas = () => {
  const [partes, setPartes] = useState<ParteInteressada[]>([]);
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const navigate = useNavigate();

  const loadPartes = async () => {
    const data = await db.partes.toArray();
    setPartes(data);
  };

  useEffect(() => { loadPartes(); }, []);

  const filtered = partes.filter((p) => {
    const matchesTipo = tipoFilter === "todos" || p.tipoPessoa === tipoFilter;
    const name = (p.nome || p.razaoSocial || "").toLowerCase();
    const matchesSearch = !search || name.includes(search.toLowerCase()) || (p.cpfCnpj || "").includes(search) || (p.email || "").toLowerCase().includes(search.toLowerCase());
    return matchesTipo && matchesSearch;
  });

  const handleDelete = async (id: string) => {
    const { ok, vinculos } = await podeExcluirParte(id);
    if (!ok) {
      toast.error(`Esta parte está vinculada a ${vinculos} processo${vinculos > 1 ? "s" : ""}. Remova os vínculos antes de excluir.`);
      return;
    }
    if (!confirm("Deseja realmente excluir esta parte?")) return;
    try {
      await excluirParte(id);
      toast.success("Parte excluída");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir a parte");
    }
    loadPartes();
  };

  const tipoIcon = (tipo: string) => {
    if (tipo === "Pessoa Jurídica" || tipo === "Órgão Público" || tipo === "Entidade") return <Building2 className="h-4 w-4" />;
    return <User className="h-4 w-4" />;
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-foreground">Partes Interessadas</h1>
            <p className="text-muted-foreground text-sm mt-1">Cadastro de pessoas e entidades vinculadas aos processos</p>
          </div>
          <NovaParteDialog onSaved={loadPartes} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, CPF/CNPJ, email..." className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {["todos", "Pessoa Física", "Pessoa Jurídica", "Órgão Público"].map((t) => (
              <button key={t} onClick={() => setTipoFilter(t)} className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${tipoFilter === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/30"}`}>
                {t === "todos" ? "Todos" : t}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-lg border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nome</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden md:table-cell">Tipo</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden lg:table-cell">CPF/CNPJ</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden md:table-cell">Contato</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {p.foto ? (
                          <img src={p.foto} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            {tipoIcon(p.tipoPessoa)}
                          </div>
                        )}
                        <div>
                          <button onClick={() => navigate(`/partes/${p.id}`)} className="font-medium text-foreground hover:text-primary hover:underline text-left">
                            {p.nome || p.razaoSocial}
                          </button>
                          <p className="text-xs text-muted-foreground md:hidden">{p.tipoPessoa}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{p.tipoPessoa}</td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-xs hidden lg:table-cell">{p.cpfCnpj || "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{p.telefone || p.email || "—"}</td>
                    <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/partes/${p.id}`)}><Eye className="h-4 w-4" /></Button>
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
              <UsersRound className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma parte interessada encontrada</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default PartesInteressadas;
