import type { Prazo, Processo, User } from "@/types";
import { statusEfetivoPrazo } from "@/lib/dates";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Chaves "YYYY-MM" dos últimos `n` meses, terminando no mês de `hoje`. */
export function ultimosMeses(hoje: string, n: number): string[] {
  const [y, m] = hoje.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - 1 - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

const rotuloMes = (chave: string) => {
  const [y, m] = chave.split("-");
  return `${MESES[Number(m) - 1]}/${y.slice(2)}`;
};

/**
 * Números dos Relatórios a partir dos dados reais.
 * O período (`meses`) vale para os gráficos mensais e para "prazos cumpridos";
 * os totais de processos e os atrasados são a situação atual.
 */
export function calcularRelatorio(
  { processos, prazos, users, meses, hoje }: { processos: Processo[]; prazos: Prazo[]; users: User[]; meses: number; hoje: string },
) {
  const chaves = ultimosMeses(hoje, meses);
  const inicio = `${chaves[0]}-01`;
  const noPeriodo = (iso?: string) => !!iso && iso.slice(0, 10) >= inicio && iso.slice(0, 10) <= hoje;

  const contar = (s: Processo["status"]) => processos.filter((p) => p.status === s).length;
  const status = [
    { name: "Ativos", value: contar("ativo"), color: "hsl(16, 88%, 54%)" },
    { name: "Pendentes", value: contar("pendente"), color: "hsl(38, 92%, 50%)" },
    { name: "Concluídos", value: contar("concluido"), color: "hsl(174, 100%, 30%)" },
    { name: "Arquivados", value: contar("arquivado"), color: "hsl(220, 10%, 60%)" },
  ];

  const nomes = Object.fromEntries(users.map((u) => [u.id, u.nome]));
  const porResp = new Map<string, number>();
  for (const p of processos) {
    const nome = (p.responsavelId && nomes[p.responsavelId]) || "Sem responsável";
    porResp.set(nome, (porResp.get(nome) || 0) + 1);
  }
  const porResponsavel = [...porResp.entries()]
    .map(([nome, processos]) => ({ nome, processos }))
    .sort((a, b) => b.processos - a.processos)
    .slice(0, 8);

  const efetivo = (p: Prazo) => statusEfetivoPrazo(p, hoje);
  const prazosPorMes = chaves.map((c) => {
    const doMes = prazos.filter((p) => p.dataLimite?.startsWith(c) && p.dataLimite <= hoje);
    return {
      mes: rotuloMes(c),
      cumpridos: doMes.filter((p) => efetivo(p) === "cumprido").length,
      atrasados: doMes.filter((p) => efetivo(p) === "atrasado").length,
    };
  });

  // Total acumulado de processos ao fim de cada mês (pela data de cadastro).
  const evolucao = chaves.map((c) => ({
    mes: rotuloMes(c),
    total: processos.filter((p) => (p.dataCadastro || "").slice(0, 7) <= c).length,
  }));

  return {
    kpis: {
      totalProcessos: processos.length,
      concluidos: contar("concluido"),
      prazosCumpridos: prazos.filter((p) => efetivo(p) === "cumprido" && noPeriodo(p.dataLimite)).length,
      prazosAtrasados: prazos.filter((p) => efetivo(p) === "atrasado").length,
    },
    status,
    porResponsavel,
    prazosPorMes,
    evolucao,
  };
}
