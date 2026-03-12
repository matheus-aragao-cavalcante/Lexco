import { AppLayout } from "@/components/AppLayout";
import { KPICard } from "@/components/KPICard";
import { FolderOpen, CheckCircle2, Clock, AlertTriangle, Users, FileText, CalendarDays } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const statusData = [
  { name: "Ativos", value: 45, color: "hsl(16, 88%, 54%)" },
  { name: "Pendentes", value: 23, color: "hsl(38, 92%, 50%)" },
  { name: "Concluídos", value: 32, color: "hsl(174, 100%, 30%)" },
];

const advogadoData = [
  { nome: "Dr. Oliveira", processos: 28 },
  { nome: "Dra. Costa", processos: 22 },
  { nome: "Dr. Silva", processos: 19 },
  { nome: "Dra. Lima", processos: 15 },
  { nome: "Dr. Santos", processos: 12 },
];

const prazoData = [
  { mes: "Jan", cumpridos: 18, atrasados: 3 },
  { mes: "Fev", cumpridos: 22, atrasados: 5 },
  { mes: "Mar", cumpridos: 20, atrasados: 2 },
  { mes: "Abr", cumpridos: 25, atrasados: 4 },
  { mes: "Mai", cumpridos: 28, atrasados: 2 },
  { mes: "Jun", cumpridos: 30, atrasados: 3 },
];

const evolucao = [
  { mes: "Jan", total: 65 },
  { mes: "Fev", total: 78 },
  { mes: "Mar", total: 85 },
  { mes: "Abr", total: 92 },
  { mes: "Mai", total: 95 },
  { mes: "Jun", total: 100 },
];

const Relatorios = () => (
  <AppLayout>
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-1">Análise operacional e produtividade</p>
        </div>
        <div className="flex gap-2">
          <select className="h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground">
            <option>Último mês</option>
            <option>Últimos 3 meses</option>
            <option>Últimos 6 meses</option>
            <option>Último ano</option>
          </select>
          <button
            onClick={() => {
              window.print();
            }}
            className="h-9 px-4 rounded-lg border border-input bg-card text-sm text-foreground hover:bg-muted transition-colors"
          >
            Exportar PDF
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Processos" value={100} icon={FolderOpen} variant="default" />
        <KPICard title="Concluídos" value={32} icon={CheckCircle2} variant="success" />
        <KPICard title="Prazos Cumpridos" value={143} icon={Clock} variant="success" />
        <KPICard title="Prazos Atrasados" value={19} icon={AlertTriangle} variant="destructive" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border shadow-card p-5">
          <h3 className="font-heading font-semibold text-foreground mb-4">Processos por Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" outerRadius={90} innerRadius={55} paddingAngle={4} dataKey="value">
                {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            {statusData.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} /> {s.name}: {s.value}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-lg border shadow-card p-5">
          <h3 className="font-heading font-semibold text-foreground mb-4">Processos por Advogado</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={advogadoData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,89%)" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(220,10%,46%)" />
              <YAxis dataKey="nome" type="category" tick={{ fontSize: 12 }} stroke="hsl(220,10%,46%)" width={100} />
              <Tooltip />
              <Bar dataKey="processos" fill="hsl(16,88%,54%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-lg border shadow-card p-5">
          <h3 className="font-heading font-semibold text-foreground mb-4">Prazos: Cumpridos vs Atrasados</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={prazoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,89%)" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="hsl(220,10%,46%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(220,10%,46%)" />
              <Tooltip />
              <Bar dataKey="cumpridos" fill="hsl(174,100%,30%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="atrasados" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-lg border shadow-card p-5">
          <h3 className="font-heading font-semibold text-foreground mb-4">Evolução de Processos</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,89%)" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="hsl(220,10%,46%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(220,10%,46%)" />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="hsl(16,88%,54%)" strokeWidth={2} dot={{ fill: "hsl(16,88%,54%)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  </AppLayout>
);

export default Relatorios;
