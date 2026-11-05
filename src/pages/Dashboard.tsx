import { AppLayout } from "@/components/AppLayout";
import { KPICard } from "@/components/KPICard";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/db";
import { formatarData, hojeISO, somarDiasISO, statusEfetivoPrazo } from "@/lib/dates";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FolderOpen, Clock, CheckCircle2, AlertTriangle,
  FileText, CalendarDays, TrendingUp, Users
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { Processo, Prazo, Evento } from "@/types";

const Dashboard = () => {
  const { currentUser } = useAuth();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [prazos, setPrazos] = useState<Prazo[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);

  useEffect(() => {
    db.processos.toArray().then(setProcessos);
    db.prazos.toArray().then(setPrazos);
    db.eventos.toArray().then(setEventos);
  }, []);

  const ativos = processos.filter((p) => p.status === "ativo").length;
  const pendentes = processos.filter((p) => p.status === "pendente").length;
  const concluidos = processos.filter((p) => p.status === "concluido").length;
  const today = hojeISO();
  const tomorrow = somarDiasISO(today, 1);
  // Mais urgentes primeiro (data e hora); recentes = últimos cadastrados.
  const prazosProximos = prazos
    .filter((p) => p.status !== "cumprido")
    .sort((a, b) => `${a.dataLimite} ${a.hora || ""}`.localeCompare(`${b.dataLimite} ${b.hora || ""}`))
    .slice(0, 5);
  const processosRecentes = [...processos]
    .sort((a, b) => (b.dataCadastro || "").localeCompare(a.dataCadastro || ""))
    .slice(0, 5);
  const prazosHoje = prazos.filter((p) => p.dataLimite === today && p.status !== "cumprido").length;
  const prazosAmanha = prazos.filter((p) => p.dataLimite === tomorrow && p.status !== "cumprido").length;

  const pieData = [
    { name: "Ativos", value: ativos, color: "hsl(16, 88%, 54%)" },
    { name: "Pendentes", value: pendentes || 0, color: "hsl(38, 92%, 50%)" },
    { name: "Concluídos", value: concluidos || 0, color: "hsl(174, 100%, 30%)" },
  ];

  const nome = currentUser?.preferencias?.nomeExibicao || currentUser?.nome || "Usuário";
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-heading font-semibold text-foreground">{saudacao}, {nome.split(" ")[0]}</h1>
          <p className="text-muted-foreground mt-1">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {(prazosHoje > 0 || pendentes > 0) && (
              <> — Você possui <span className="text-primary font-medium">{prazosHoje} prazo{prazosHoje !== 1 ? "s" : ""} hoje</span> e <span className="text-primary font-medium">{pendentes} pendência{pendentes !== 1 ? "s" : ""}</span></>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Total de Processos" value={processos.length} icon={FolderOpen} variant="default" />
          <KPICard title="Processos Ativos" value={ativos} icon={TrendingUp} variant="primary" />
          <KPICard title="Concluídos" value={concluidos} icon={CheckCircle2} variant="success" />
          <KPICard title="Prazos Hoje" value={prazosHoje} icon={Clock} variant="warning" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card rounded-lg border shadow-card p-5">
            <h3 className="font-heading font-semibold text-foreground mb-4">Processos por Status</h3>
            {processos.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Cadastre processos para ver os gráficos</div>
            )}
            <div className="flex justify-center gap-6 mt-2">
              {pieData.map((s) => (
                <span key={s.name} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} /> {s.name}: {s.value}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-lg border shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-foreground">Prazos Próximos</h3>
              <Link to="/prazos" className="text-sm text-primary hover:underline">Ver todos</Link>
            </div>
            <div className="space-y-3">
              {prazosProximos.map((prazo) => (
                <div key={prazo.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={`h-2 w-2 rounded-full mt-2 flex-shrink-0 ${prazo.dataLimite <= today ? "bg-destructive" : "bg-warning"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{prazo.titulo}</p>
                    <p className="text-xs text-muted-foreground">{formatarData(prazo.dataLimite)}{prazo.hora ? ` · ${prazo.hora}` : ""}</p>
                  </div>
                  <StatusBadge status={statusEfetivoPrazo(prazo, today)} />
                </div>
              ))}
              {prazos.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum prazo cadastrado</p>}
            </div>
          </div>
        </div>

        {/* Processos Recentes */}
        <div className="bg-card rounded-lg border shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-foreground">Processos Recentes</h3>
            <Link to="/processos" className="text-sm text-primary hover:underline">Ver todos</Link>
          </div>
          {processos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Processo</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">Número</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">Área</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {processosRecentes.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-2">
                        <Link to={`/processos/${p.id}`} className="font-medium text-foreground hover:text-primary hover:underline">{p.titulo}</Link>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground font-mono text-xs hidden md:table-cell">{p.numero || "—"}</td>
                      <td className="py-3 px-2 text-foreground hidden md:table-cell">{p.areaDireito || "—"}</td>
                      <td className="py-3 px-2"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Nenhum processo cadastrado. Comece criando seu primeiro processo.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
