import { AppLayout } from "@/components/AppLayout";
import { KPICard } from "@/components/KPICard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  FolderOpen, Clock, CheckCircle2, AlertTriangle,
  FileText, CalendarDays, TrendingUp, Users
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const barData = [
  { mes: "Jan", processos: 12 },
  { mes: "Fev", processos: 19 },
  { mes: "Mar", processos: 15 },
  { mes: "Abr", processos: 22 },
  { mes: "Mai", processos: 18 },
  { mes: "Jun", processos: 25 },
];

const pieData = [
  { name: "Ativos", value: 45, color: "hsl(16, 88%, 54%)" },
  { name: "Pendentes", value: 23, color: "hsl(38, 92%, 50%)" },
  { name: "Concluídos", value: 32, color: "hsl(174, 100%, 30%)" },
];

const prazosProximos = [
  { titulo: "Contestação - Proc. 2024/1234", processo: "Silva vs. Santos", responsavel: "Dr. Oliveira", data: "Hoje", status: "urgente" as const },
  { titulo: "Recurso de Apelação", processo: "Empresa ABC vs. Estado", responsavel: "Dra. Costa", data: "Hoje", status: "urgente" as const },
  { titulo: "Juntada de Documentos", processo: "Pereira & Associados", responsavel: "Dr. Silva", data: "Amanhã", status: "pendente" as const },
  { titulo: "Audiência de Conciliação", processo: "Caso Ferreira", responsavel: "Dra. Lima", data: "Amanhã", status: "pendente" as const },
  { titulo: "Petição Inicial", processo: "Novo caso Martins", responsavel: "Dr. Oliveira", data: "23/03", status: "pendente" as const },
];

const processosRecentes = [
  { nome: "Silva vs. Santos Ltda", numero: "0001234-56.2024.8.26.0100", cliente: "João Silva", status: "ativo" as const, atualizado: "Hoje" },
  { nome: "Empresa ABC vs. Estado", numero: "0005678-90.2024.8.26.0050", cliente: "Empresa ABC", status: "pendente" as const, atualizado: "Ontem" },
  { nome: "Caso Pereira", numero: "0009012-34.2024.8.26.0200", cliente: "Maria Pereira", status: "concluido" as const, atualizado: "12/03" },
];

const agendaHoje = [
  { hora: "09:00", titulo: "Audiência - Caso Silva", tipo: "Audiência", processo: "Silva vs. Santos" },
  { hora: "11:00", titulo: "Reunião com cliente", tipo: "Reunião", processo: "Empresa ABC" },
  { hora: "14:30", titulo: "Prazo - Contestação", tipo: "Prazo", processo: "Caso Ferreira" },
  { hora: "16:00", titulo: "Despacho com juiz", tipo: "Audiência", processo: "Pereira & Assoc." },
];

const Dashboard = () => {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        {/* Welcome */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-heading font-semibold text-foreground">Bom dia, Dr. Silva</h1>
          <p className="text-muted-foreground mt-1">
            Terça-feira, 12 de Março de 2026 — Você possui <span className="text-primary font-medium">4 prazos próximos</span> e <span className="text-primary font-medium">2 pendências</span> de documentos.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Total de Processos" value={100} icon={FolderOpen} variant="default" trend="+8 este mês" />
          <KPICard title="Processos Ativos" value={45} icon={TrendingUp} variant="primary" trend="45% do total" />
          <KPICard title="Concluídos" value={32} icon={CheckCircle2} variant="success" trend="+5 esta semana" />
          <KPICard title="Prazos Hoje" value={4} icon={Clock} variant="warning" trend="2 urgentes" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Prazos Amanhã" value={3} icon={AlertTriangle} variant="primary" />
          <KPICard title="Pendências Docs" value={7} icon={FileText} variant="destructive" />
          <KPICard title="Audiências Agendadas" value={12} icon={CalendarDays} variant="default" />
          <KPICard title="Advogados Ativos" value={8} icon={Users} variant="success" />
        </div>

        {/* Charts + Prazos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bar Chart */}
          <div className="lg:col-span-2 bg-card rounded-lg border shadow-card p-5">
            <h3 className="font-heading font-semibold text-foreground mb-4">Processos por Mês</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,89%)" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="hsl(220,10%,46%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(220,10%,46%)" />
                <Tooltip />
                <Bar dataKey="processos" fill="hsl(16,88%,54%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          <div className="bg-card rounded-lg border shadow-card p-5">
            <h3 className="font-heading font-semibold text-foreground mb-4">Por Status</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-medium text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Prazos Próximos + Agenda */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Prazos */}
          <div className="bg-card rounded-lg border shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-foreground">Prazos Próximos</h3>
              <a href="/prazos" className="text-sm text-primary hover:underline">Ver todos</a>
            </div>
            <div className="space-y-3">
              {prazosProximos.map((prazo, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={`h-2 w-2 rounded-full mt-2 flex-shrink-0 ${prazo.status === "urgente" ? "bg-primary" : "bg-warning"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{prazo.titulo}</p>
                    <p className="text-xs text-muted-foreground">{prazo.processo} · {prazo.responsavel}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <StatusBadge status={prazo.status} />
                    <p className="text-xs text-muted-foreground mt-1">{prazo.data}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Agenda do dia */}
          <div className="bg-card rounded-lg border shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-foreground">Agenda de Hoje</h3>
              <a href="/agenda" className="text-sm text-primary hover:underline">Ver agenda</a>
            </div>
            <div className="space-y-3">
              {agendaHoje.map((evento, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className="text-sm font-mono text-primary font-medium w-12 flex-shrink-0">{evento.hora}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{evento.titulo}</p>
                    <p className="text-xs text-muted-foreground">{evento.processo}</p>
                  </div>
                  <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 flex-shrink-0">{evento.tipo}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Processos Recentes */}
        <div className="bg-card rounded-lg border shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-foreground">Processos Recentes</h3>
            <a href="/processos" className="text-sm text-primary hover:underline">Ver todos</a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Processo</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Número</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Cliente</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Status</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {processosRecentes.map((p, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-2 font-medium text-foreground">{p.nome}</td>
                    <td className="py-3 px-2 text-muted-foreground font-mono text-xs">{p.numero}</td>
                    <td className="py-3 px-2 text-foreground">{p.cliente}</td>
                    <td className="py-3 px-2"><StatusBadge status={p.status} /></td>
                    <td className="py-3 px-2 text-muted-foreground">{p.atualizado}</td>
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

export default Dashboard;
