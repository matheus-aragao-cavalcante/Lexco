import { AppLayout } from "@/components/AppLayout";
import { KPICard } from "@/components/KPICard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, CheckCircle2, CalendarDays, List, Timer } from "lucide-react";
import { useState } from "react";
import { NovoPrazoDialog } from "@/components/NovoPrazoDialog";

const prazos = [
  { id: 1, titulo: "Contestação - Silva vs Santos", processo: "0001234-56.2024", cliente: "João Silva", responsavel: "Dr. Oliveira", dataLimite: "12/03/2026", status: "urgente" as const, prioridade: "Alta" },
  { id: 2, titulo: "Recurso de Apelação", processo: "0005678-90.2024", cliente: "Empresa ABC", responsavel: "Dra. Costa", dataLimite: "12/03/2026", status: "urgente" as const, prioridade: "Alta" },
  { id: 3, titulo: "Juntada de Documentos", processo: "0009012-34.2024", cliente: "Maria Pereira", responsavel: "Dr. Silva", dataLimite: "13/03/2026", status: "pendente" as const, prioridade: "Média" },
  { id: 4, titulo: "Audiência de Conciliação", processo: "0003456-78.2024", cliente: "Carlos Martins", responsavel: "Dra. Lima", dataLimite: "13/03/2026", status: "pendente" as const, prioridade: "Média" },
  { id: 5, titulo: "Petição Inicial", processo: "0007890-12.2024", cliente: "Pedro Rodrigues", responsavel: "Dr. Oliveira", dataLimite: "15/03/2026", status: "pendente" as const, prioridade: "Normal" },
  { id: 6, titulo: "Parecer Jurídico", processo: "0002345-67.2024", cliente: "Omega Tech", responsavel: "Dra. Costa", dataLimite: "18/03/2026", status: "pendente" as const, prioridade: "Normal" },
  { id: 7, titulo: "Laudo Pericial", processo: "0001234-56.2024", cliente: "João Silva", responsavel: "Dr. Silva", dataLimite: "10/03/2026", status: "atrasado" as const, prioridade: "Alta" },
  { id: 8, titulo: "Entrega de Mandado", processo: "0005678-90.2024", cliente: "Empresa ABC", responsavel: "Dra. Lima", dataLimite: "05/03/2026", status: "cumprido" as const, prioridade: "Normal" },
];

const Prazos = () => {
  const [view, setView] = useState<"lista" | "timeline">("lista");
  const [statusFilter, setStatusFilter] = useState("todos");

  const filtered = prazos.filter((p) => statusFilter === "todos" || p.status === statusFilter);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-foreground">Prazos</h1>
            <p className="text-muted-foreground text-sm mt-1">Controle de prazos jurídicos</p>
          </div>
          <NovoPrazoDialog />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard title="Hoje" value={2} icon={Clock} variant="warning" />
          <KPICard title="Amanhã" value={2} icon={CalendarDays} variant="primary" />
          <KPICard title="Esta Semana" value={6} icon={Timer} variant="default" />
          <KPICard title="Atrasados" value={1} icon={AlertTriangle} variant="destructive" />
          <KPICard title="Cumpridos" value={1} icon={CheckCircle2} variant="success" />
        </div>

        {/* Filters + View Toggle */}
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <div className="flex gap-2 flex-wrap">
            {[
              { key: "todos", label: "Todos" },
              { key: "urgente", label: "Urgentes" },
              { key: "pendente", label: "Pendentes" },
              { key: "atrasado", label: "Atrasados" },
              { key: "cumprido", label: "Cumpridos" },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  statusFilter === s.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/30"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button onClick={() => setView("lista")} className={`px-3 py-1 rounded text-sm transition-colors ${view === "lista" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setView("timeline")} className={`px-3 py-1 rounded text-sm transition-colors ${view === "timeline" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <Timer className="h-4 w-4" />
            </button>
          </div>
        </div>

        {view === "lista" ? (
          <div className="bg-card rounded-lg border shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Prazo</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden md:table-cell">Processo</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden lg:table-cell">Responsável</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data Limite</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden sm:table-cell">Prioridade</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium text-foreground">{p.titulo}</p>
                        <p className="text-xs text-muted-foreground md:hidden">{p.processo}</p>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono text-xs hidden md:table-cell">{p.processo}</td>
                      <td className="py-3 px-4 text-foreground hidden lg:table-cell">{p.responsavel}</td>
                      <td className="py-3 px-4 text-foreground font-medium">{p.dataLimite}</td>
                      <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                      <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">{p.prioridade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Timeline view */
          <div className="bg-card rounded-lg border shadow-card p-6">
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              <div className="space-y-6">
                {filtered.map((p) => (
                  <div key={p.id} className="relative pl-10">
                    <div className={`absolute left-2.5 top-1.5 h-3 w-3 rounded-full border-2 ${
                      p.status === "urgente" ? "bg-primary border-primary" :
                      p.status === "atrasado" ? "bg-destructive border-destructive" :
                      p.status === "cumprido" ? "bg-success border-success" :
                      "bg-warning border-warning"
                    }`} />
                    <div className="p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-foreground">{p.titulo}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{p.processo} · {p.responsavel}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <StatusBadge status={p.status} />
                          <p className="text-xs text-muted-foreground mt-1">{p.dataLimite}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Prazos;
