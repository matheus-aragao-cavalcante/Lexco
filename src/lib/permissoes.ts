import type { User } from "@/types";

/**
 * Permissões individuais de cada usuário.
 *
 * No próprio computador elas controlam a interface. No acesso remoto (ambiente
 * compartilhado) elas valem também nos DADOS: o pacote enviado ao convidado só
 * contém o que ele pode ver, e cada alteração que ele faz é conferida no
 * computador do administrador antes de ser aplicada (src/lib/compartilhamento).
 */
export interface Permissoes {
  verProcessos: boolean;
  cadastrarProcessos: boolean;
  editarProcessos: boolean;
  excluirProcessos: boolean;
  /** Número do processo, modalidade/nomenclatura e partes vinculadas (manifestantes etc.). */
  editarSensiveis: boolean;
  /** CPF/CNPJ, telefone, e-mail, endereço e nome completo das partes. */
  verDadosPessoais: boolean;
  tarefas: "nenhum" | "ver" | "editar";
  documentos: "nenhum" | "ver" | "anexar";
  verHistorico: boolean;
  /** Exportar CSV/arquivo de backup e restaurar. */
  exportar: boolean;
}

export const PERMISSOES_TOTAIS: Permissoes = {
  verProcessos: true, cadastrarProcessos: true, editarProcessos: true, excluirProcessos: true,
  editarSensiveis: true, verDadosPessoais: true, tarefas: "editar", documentos: "anexar",
  verHistorico: true, exportar: true,
};

/**
 * Padrão de todo usuário que ainda não teve permissões definidas: acesso
 * completo — exatamente como o sistema funcionava antes das permissões.
 * O administrador restringe na tela de Usuários.
 */
export const PERMISSOES_PADRAO: Record<User["perfil"], Permissoes> = {
  admin: PERMISSOES_TOTAIS,
  advogado: PERMISSOES_TOTAIS,
  colaborador: PERMISSOES_TOTAIS,
};

/** Modelos prontos para a tela de permissões. */
export const MODELOS_PERMISSAO: { id: string; nome: string; descricao: string; permissoes: Permissoes }[] = [
  {
    id: "leitura", nome: "Somente leitura", descricao: "Vê processos e tarefas, sem alterar e sem dados pessoais",
    permissoes: {
      verProcessos: true, cadastrarProcessos: false, editarProcessos: false, excluirProcessos: false,
      editarSensiveis: false, verDadosPessoais: false, tarefas: "ver", documentos: "ver", verHistorico: true, exportar: false,
    },
  },
  {
    id: "colaborador", nome: "Colaborador", descricao: "Atualiza andamentos, prazos e tarefas; não muda número nem partes",
    permissoes: {
      verProcessos: true, cadastrarProcessos: false, editarProcessos: true, excluirProcessos: false,
      editarSensiveis: false, verDadosPessoais: false, tarefas: "editar", documentos: "anexar", verHistorico: true, exportar: false,
    },
  },
  {
    id: "advogado", nome: "Advogado", descricao: "Cadastra e edita tudo, inclusive dados sensíveis; não exclui",
    permissoes: { ...PERMISSOES_TOTAIS, excluirProcessos: false, exportar: false },
  },
  { id: "completo", nome: "Acesso completo", descricao: "Tudo, inclusive excluir e exportar", permissoes: PERMISSOES_TOTAIS },
];

export function permissoesDe(user: Pick<User, "perfil"> & { permissoes?: Partial<Permissoes> } | null | undefined): Permissoes {
  if (!user) return { ...PERMISSOES_PADRAO.colaborador, verProcessos: false };
  if (user.perfil === "admin") return PERMISSOES_TOTAIS; // admin nunca perde acesso
  const base = PERMISSOES_PADRAO[user.perfil] ?? PERMISSOES_PADRAO.colaborador;
  const p = { ...base, ...(user.permissoes || {}) };
  // Coerência: sem ver processos não há o que editar.
  if (!p.verProcessos) {
    p.cadastrarProcessos = p.editarProcessos = p.excluirProcessos = p.editarSensiveis = false;
  }
  return p;
}

export const ROTULOS_PERMISSOES: { chave: keyof Permissoes; rotulo: string; dica?: string }[] = [
  { chave: "verProcessos", rotulo: "Visualizar processos" },
  { chave: "cadastrarProcessos", rotulo: "Cadastrar processos e partes" },
  { chave: "editarProcessos", rotulo: "Editar processos, prazos e eventos" },
  { chave: "excluirProcessos", rotulo: "Excluir processos e partes" },
  { chave: "editarSensiveis", rotulo: "Alterar dados sensíveis", dica: "Número do processo, modalidade e partes vinculadas (manifestantes)" },
  { chave: "verDadosPessoais", rotulo: "Ver dados pessoais", dica: "CPF/CNPJ, telefone, e-mail, endereço e nome completo" },
  { chave: "verHistorico", rotulo: "Ver histórico de alterações" },
  { chave: "exportar", rotulo: "Exportar dados e fazer backup" },
];

/** Nome reduzido ("Maria da Silva Souza" → "Maria S.") quando os dados pessoais estão ocultos. */
export function nomeReduzido(nome: string): string {
  const partes = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] || "";
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

/** "529.982.247-25" → "***.982.247-**" ; CNPJ → "**.***.345/01DE-**". */
export function mascararDocumentoParcial(doc: string): string {
  const d = (doc || "").trim();
  if (!d) return "";
  let i = 0;
  const alnum = d.replace(/[^0-9A-Za-z]/g, "").length;
  return d.replace(/[0-9A-Za-z]/g, (c) => {
    const pos = i++;
    // mostra só o miolo do documento
    return pos >= 3 && pos < alnum - 2 ? c : "*";
  });
}
