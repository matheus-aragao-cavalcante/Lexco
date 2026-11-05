import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AppLayout } from "@/components/AppLayout";
import { KPICard } from "@/components/KPICard";
import { FolderOpen, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { db } from "@/lib/db";
import { hojeISO } from "@/lib/dates";
import { calcularRelatorio } from "@/lib/relatorios";

const PERIODOS = [
  { meses: 1, label: "Último mês" },
  { meses: 3, label: "Últimos 3 meses" },
  { meses: 6, label: "Últimos 6 meses" },
  { meses: 12, label: "Último ano" },
];

const eixo = { tick: { fontSize: 12 }, stroke: "hsl(220,10%,46%)" };

const Relatorios = () => {
  const [meses, setMeses] = useState(6);
  const dados = useLiveQuery(async () => ({
    processos: await db.processos.toArray(),
    prazos: await db.prazos.toArray(),
    users: await db.users.toArray(),
  }), []);

  const r = useMemo(() => (dados ? calcularRelatorio({ ...dados, meses, hoje: hojeISO() }) : null), [dados, meses]);
  const semProcessos = !dados || dados.processos.length === 0;
  const semPrazos = !r || r.prazosPorMes.every((m) => m.cumpridos + m.atrasados === 0);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-foreground">Relatórios</h1>
            <p className="text-muted-foreground text-sm mt-1">Análise operacional e produtividade</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <select
              value={meses}
              onChange={(e) => setMeses(Number(e.target.value))}
              className="h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground"
              aria-label="Período"
            >
              {PERIODOS.map((p) => <option key={p.meses} value={p.meses}>{p.label}</option>)}
            </select>
            <button
              onClick={() => window.print()}
              className="h-9 px-4 rounded-lg border border-input bg-card text-sm text-foreground hover:bg-muted transition-colors"
            >
              Exportar PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Total de Processos" value={r?.kpis.totalProcessos ?? 0} icon={FolderOpen} variant="default" />
          <KPICard title="Concluídos" value={r?.kpis.concluidos ?? 0} icon={CheckCircle2} variant="success" />
          <KPICard title="Prazos Cumpridos (período)" value={r?.kpis.prazosCumpridos ?? 0} icon={Clock} variant="success" />
          <KPICard title="Prazos Atrasados" value={r?.kpis.prazosAtrasados ?? 0} icon={AlertTriangle} variant="destructive" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Painel titulo="Processos por Status" vazio={semProcessos} msgVazio="Cadastre processos para ver este gráfico">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={r?.status.filter((s) => s.value > 0)} cx="50%" cy="50%" outerRadius={90} innerRadius={55} paddingAngle={4} dataKey="value">
                  {r?.status.filter((s) => s.value > 0).map((e) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center flex-wrap gap-x-6 gap-y-1 mt-2">
              {r?.status.map((s) => (
                <span key={s.name} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} /> {s.name}: {s.value}
                </span>
              ))}
            </div>
          </Painel>

          <Painel titulo="Processos por Responsável" vazio={semProcessos} msgVazio="Cadastre processos para ver este gráfico">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={r?.porResponsavel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,89%)" />
                <XAxis type="number" allowDecimals={false} {...eixo} />
                <YAxis dataKey="nome" type="category" width={120} {...eixo} />
                <Tooltip />
                <Bar dataKey="processos" name="Processos" fill="hsl(16,88%,54%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Painel>

          <Painel titulo="Prazos: Cumpridos vs Atrasados" vazio={semPrazos} msgVazio="Nenhum prazo vencido no período">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={r?.prazosPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,89%)" />
                <XAxis dataKey="mes" {...eixo} />
                <YAxis allowDecimals={false} {...eixo} />
                <Tooltip />
                <Legend />
                <Bar dataKey="cumpridos" name="Cumpridos" fill="hsl(174,100%,30%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="atrasados" name="Atrasados" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Painel>

          <Painel titulo="Evolução de Processos" vazio={semProcessos} msgVazio="Cadastre processos para ver este gráfico">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={r?.evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,89%)" />
                <XAxis dataKey="mes" {...eixo} />
                <YAxis allowDecimals={false} {...eixo} />
                <Tooltip />
                <Line type="monotone" dataKey="total" name="Total" stroke="hsl(16,88%,54%)" strokeWidth={2} dot={{ fill: "hsl(16,88%,54%)" }} />
              </LineChart>
            </ResponsiveContainer>
          </Painel>
        </div>
      </div>
    </AppLayout>
  );
};

function Painel({ titulo, vazio, msgVazio, children }: { titulo: string; vazio: boolean; msgVazio: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg border shadow-card p-5">
      <h3 className="font-heading font-semibold text-foreground mb-4">{titulo}</h3>
      {vazio ? (
        <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">{msgVazio}</div>
      ) : (
        children
      )}
    </div>
  );
}

export default Relatorios;
