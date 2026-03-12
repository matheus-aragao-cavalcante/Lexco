import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Search, Eye, Edit, Shield } from "lucide-react";
import { useState } from "react";
import { NovoUsuarioDialog } from "@/components/NovoUsuarioDialog";

const usuarios = [
  { id: 1, nome: "Dr. Carlos Oliveira", email: "oliveira@lexcontrol.com", cargo: "Advogado Sênior", perfil: "admin", status: "ativo" as const, processos: 28, cadastro: "15/01/2024" },
  { id: 2, nome: "Dra. Ana Costa", email: "costa@lexcontrol.com", cargo: "Advogada", perfil: "advogado", status: "ativo" as const, processos: 22, cadastro: "20/02/2024" },
  { id: 3, nome: "Dr. Ricardo Silva", email: "silva@lexcontrol.com", cargo: "Advogado", perfil: "advogado", status: "ativo" as const, processos: 19, cadastro: "10/03/2024" },
  { id: 4, nome: "Dra. Beatriz Lima", email: "lima@lexcontrol.com", cargo: "Advogada Júnior", perfil: "advogado", status: "ativo" as const, processos: 15, cadastro: "01/05/2024" },
  { id: 5, nome: "Dr. Fernando Santos", email: "santos@lexcontrol.com", cargo: "Advogado", perfil: "colaborador", status: "inativo" as const, processos: 12, cadastro: "15/06/2024" },
  { id: 6, nome: "Mariana Souza", email: "souza@lexcontrol.com", cargo: "Assistente Jurídico", perfil: "colaborador", status: "ativo" as const, processos: 0, cadastro: "01/08/2024" },
];

const perfilBadge: Record<string, string> = {
  admin: "bg-primary/10 text-primary",
  advogado: "bg-success/10 text-success",
  colaborador: "bg-muted text-muted-foreground",
};

const Usuarios = () => {
  const [search, setSearch] = useState("");
  const filtered = usuarios.filter((u) =>
    search === "" || u.nome.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-foreground">Usuários</h1>
            <p className="text-muted-foreground text-sm mt-1">Gestão de advogados e colaboradores</p>
          </div>
          <NovoUsuarioDialog />
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="bg-card rounded-lg border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nome</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden md:table-cell">Email</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden lg:table-cell">Cargo</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Perfil</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden sm:table-cell">Processos</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-primary">{u.nome.split(" ").map(n => n[0]).slice(0, 2).join("")}</span>
                        </div>
                        <span className="font-medium text-foreground">{u.nome}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{u.email}</td>
                    <td className="py-3 px-4 text-foreground hidden lg:table-cell">{u.cargo}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${perfilBadge[u.perfil]}`}>
                        {u.perfil === "admin" && <Shield className="h-3 w-3" />}
                        {u.perfil.charAt(0).toUpperCase() + u.perfil.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={u.status} /></td>
                    <td className="py-3 px-4 text-foreground hidden sm:table-cell">{u.processos}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Usuarios;
