import type { Evento, Prazo, UserPreferences } from "@/types";
import { formatarData, somarDiasISO } from "@/lib/dates";

export type TipoNotificacao = "urgente" | "aviso" | "info";

export interface Notificacao {
  /** Estável entre recargas (usado para marcar como lida). Muda se a situação mudar. */
  id: string;
  tipo: TipoNotificacao;
  titulo: string;
  descricao: string;
  url: string;
  /** Para ordenar: mais urgente primeiro. */
  ordem: string;
}

/**
 * Gera as notificações a partir dos dados reais — nada é inventado.
 * Respeita as preferências do usuário (Perfil > Preferências): ausente = ligado.
 */
export function gerarNotificacoes(
  { prazos, eventos, prefs, hoje }: { prazos: Prazo[]; eventos: Evento[]; prefs?: Partial<UserPreferences>; hoje: string },
): Notificacao[] {
  const amanha = somarDiasISO(hoje, 1);
  const ligado = (k: keyof UserPreferences) => prefs?.[k] !== false;
  const out: Notificacao[] = [];

  for (const p of prazos) {
    if (p.status === "cumprido" || !p.dataLimite) continue;
    const url = p.processoId ? `/processos/${p.processoId}` : "/prazos";
    const quando = `${formatarData(p.dataLimite)}${p.hora ? ` às ${p.hora}` : ""}`;

    if (p.dataLimite < hoje && ligado("notifPendencias")) {
      out.push({ id: `prazo-atrasado-${p.id}-${p.dataLimite}`, tipo: "urgente", titulo: "Prazo atrasado", descricao: `${p.titulo} · venceu em ${quando}`, url, ordem: `0-${p.dataLimite}` });
    } else if (p.dataLimite === hoje && ligado("notifPrazoHoje")) {
      out.push({ id: `prazo-hoje-${p.id}-${p.dataLimite}`, tipo: "urgente", titulo: "Prazo vence hoje", descricao: `${p.titulo}${p.hora ? ` · até ${p.hora}` : ""}`, url, ordem: `1-${p.hora || ""}` });
    } else if (p.dataLimite === amanha && ligado("notifPrazo1Dia")) {
      out.push({ id: `prazo-amanha-${p.id}-${p.dataLimite}`, tipo: "aviso", titulo: "Prazo vence amanhã", descricao: `${p.titulo} · ${quando}`, url, ordem: `2-${p.hora || ""}` });
    }
  }

  if (ligado("notifAgenda")) {
    for (const e of eventos) {
      const aberto = e.status === "pendente" || e.status === "em_andamento";
      if (!aberto || (e.data !== hoje && e.data !== amanha)) continue;
      const dia = e.data === hoje ? "hoje" : "amanhã";
      const tarefa = e.tipo === "tarefa";
      out.push({
        id: `evento-${e.id}-${e.data}-${e.horaInicio || ""}`,
        tipo: e.data === hoje ? "aviso" : "info",
        titulo: tarefa
          ? `Tarefa vence ${dia}${e.horaInicio ? ` às ${e.horaInicio}` : ""}`
          : `Compromisso ${dia}${e.horaInicio ? ` às ${e.horaInicio}` : ""}`,
        descricao: e.titulo,
        url: "/agenda",
        ordem: `${e.data === hoje ? 3 : 4}-${e.horaInicio || ""}`,
      });
    }
  }

  return out.sort((a, b) => a.ordem.localeCompare(b.ordem));
}

// ---- lidas (por usuário, neste computador) ----

const chaveLidas = (userId: string) => `lexco_notif_lidas_${userId}`;

export function carregarLidas(userId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(chaveLidas(userId)) || "[]"));
  } catch {
    return new Set();
  }
}

/** Salva só as lidas que ainda existem (a lista não cresce para sempre). */
export function salvarLidas(userId: string, lidas: Set<string>, atuais: Notificacao[]) {
  const vivas = atuais.filter((n) => lidas.has(n.id)).map((n) => n.id);
  localStorage.setItem(chaveLidas(userId), JSON.stringify(vivas));
}
