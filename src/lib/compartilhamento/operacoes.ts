import Dexie, { type Transaction } from "dexie";
import { deleteProcessoCascata, type LexcoDB } from "@/lib/db";
import type { Permissoes } from "@/lib/permissoes";
import type { Evento, Processo, ResultadoOperacao } from "@/types";

/**
 * Alterações feitas por um convidado no ambiente compartilhado.
 *
 * No computador do convidado, cada gravação no banco do ambiente vira uma
 * "operação" (criar / alterar campos / excluir). Elas vão cifradas para o Drive e
 * o computador do ADMINISTRADOR decide, uma a uma, o que aplicar:
 *  - confere as permissões do convidado (não só a tela: os dados);
 *  - aplica campo a campo, só se o valor no banco ainda for o que o convidado viu
 *    (senão é conflito e o valor do administrador é mantido);
 *  - devolve o resultado (aplicada / parcial / rejeitada) no próximo pacote.
 */

export type TabelaCompartilhada = "processos" | "partes" | "vinculos" | "eventos" | "prazos" | "arquivos" | "historico";
export const TABELAS_COMPARTILHADAS: TabelaCompartilhada[] = ["processos", "partes", "vinculos", "eventos", "prazos", "arquivos", "historico"];

export interface Operacao {
  id: string;
  em: string;
  tabela: TabelaCompartilhada;
  tipo: "criar" | "alterar" | "excluir";
  chave: string;
  /** criar: objeto completo */
  valores?: Record<string, unknown>;
  /** alterar: campo → valor anterior (o que o convidado via) e novo */
  campos?: Record<string, { de: unknown; para: unknown }>;
  /** excluir: objeto como o convidado via */
  antes?: Record<string, unknown>;
}

// ---------------------------------------------------------------- captura

const MARCA_SYNC = "__lexcoSync";

/** Executa gravações do próprio sincronizador sem registrá-las como alterações do usuário. */
export function semCaptura<T>(db: LexcoDB, tabelas: string[], fn: () => Promise<T>): Promise<T> {
  return db.transaction("rw", tabelas, async (tx) => {
    (tx as unknown as Record<string, boolean>)[MARCA_SYNC] = true;
    return fn();
  });
}

const doSync = (tx: Transaction | undefined) => !!tx && !!(tx as unknown as Record<string, boolean>)[MARCA_SYNC];

const clonar = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/** Liga a captura no banco de um ambiente compartilhado. `registrar` recebe cada operação confirmada. */
export function instalarCaptura(db: LexcoDB, registrar: (op: Operacao) => void) {
  for (const tabela of TABELAS_COMPARTILHADAS) {
    const t = db.table(tabela);
    const nova = (tipo: Operacao["tipo"], chave: unknown, extra: Partial<Operacao>): Operacao => ({
      id: crypto.randomUUID(), em: new Date().toISOString(), tabela, tipo, chave: String(chave), ...extra,
    });
    t.hook("creating", function (chave, obj, tx) {
      if (doSync(tx)) return;
      const op = nova("criar", chave ?? (obj as { id?: string }).id, { valores: clonar(obj) });
      this.onsuccess = () => registrar(op);
    });
    t.hook("updating", function (mods, chave, obj, tx) {
      if (doSync(tx)) return;
      // Monta o objeto novo aplicando as modificações (podem vir como "a.b").
      const novo = clonar(obj) as Record<string, unknown>;
      const chavesTopo = new Set<string>();
      for (const [caminho, valor] of Object.entries(mods)) {
        Dexie.setByKeyPath(novo, caminho, valor);
        chavesTopo.add(caminho.split(".")[0]);
      }
      const campos: Operacao["campos"] = {};
      for (const k of chavesTopo) {
        const de = (obj as Record<string, unknown>)[k];
        if (JSON.stringify(de) !== JSON.stringify(novo[k])) campos[k] = { de: clonar(de) ?? null, para: clonar(novo[k]) ?? null };
      }
      if (!Object.keys(campos).length) return;
      const op = nova("alterar", chave, { campos });
      this.onsuccess = () => registrar(op);
    });
    t.hook("deleting", function (chave, obj, tx) {
      if (doSync(tx)) return;
      const op = nova("excluir", chave, { antes: clonar(obj) });
      this.onsuccess = () => registrar(op);
    });
  }
}

// ---------------------------------------------------------------- validação (administrador)

/** Campos pessoais das partes (ocultos quando o convidado não pode vê-los). */
export const CAMPOS_PESSOAIS = ["nome", "nomeSocial", "razaoSocial", "cpfCnpj", "rg", "orgaoEmissor", "dataNascimento",
  "telefone", "telefone2", "email", "endereco", "cep",
  // tipoPessoa decide o que é mascarado: trocar PF→PJ não pode "revelar" o CPF no próximo pacote.
  "tipoPessoa", "foto"] as const;

/** Campos do processo que exigem "alterar dados sensíveis". */
const CAMPOS_SENSIVEIS_PROCESSO = new Set(["numero", "modalidade", "modeloNomenclaturaId", "labelPoloAtivo", "labelPoloPassivo"]);
/** Campos que o convidado nunca altera. */
const CAMPOS_PROTEGIDOS = new Set(["id", "criadoPor", "criadoEm", "dataCadastro"]);

export interface Convidado { id: string; nome: string; permissoes: Permissoes }

const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

type Resultado = Omit<ResultadoOperacao, "em"> & { silenciosa?: boolean };

/**
 * Regra de permissão para UM estado do registro. `estado` vem SEMPRE do banco do
 * administrador (ou, ao criar, dos valores novos) — nunca de dados "informados"
 * pela própria operação, que o convidado poderia forjar.
 */
async function permitido(
  db: LexcoDB, tabela: TabelaCompartilhada, tipo: Operacao["tipo"], conv: Convidado, estado: Record<string, unknown>,
): Promise<string | null> {
  const p = conv.permissoes;
  const processoDoConvidado = async (processoId: unknown) =>
    typeof processoId === "string" && (await db.processos.get(processoId))?.criadoPor === conv.id;

  switch (tabela) {
    case "processos":
      if (!p.verProcessos) return "Sem acesso a processos.";
      if (tipo === "criar") return p.cadastrarProcessos ? null : "Sem permissão para cadastrar processos.";
      if (tipo === "excluir") return p.excluirProcessos ? null : "Sem permissão para excluir processos.";
      return p.editarProcessos ? null : "Sem permissão para editar processos.";
    case "partes":
      if (tipo === "criar") return p.cadastrarProcessos ? null : "Sem permissão para cadastrar partes.";
      if (tipo === "excluir") return p.excluirProcessos ? null : "Sem permissão para excluir partes.";
      return p.editarProcessos ? null : "Sem permissão para editar partes.";
    case "vinculos":
      // Mexer nas partes de um processo (manifestantes etc.) é dado sensível —
      // exceto no processo que o próprio convidado cadastrou.
      if (p.editarSensiveis) return null;
      if (p.cadastrarProcessos && (await processoDoConvidado(estado.processoId))) return null;
      return "Sem permissão para alterar as partes do processo.";
    case "prazos":
      if (p.editarProcessos || (p.cadastrarProcessos && (await processoDoConvidado(estado.processoId)))) return null;
      return "Sem permissão para alterar prazos.";
    case "eventos":
      if ((estado as Partial<Evento>).tipo === "tarefa") return p.tarefas === "editar" ? null : "Sem permissão para alterar tarefas.";
      if (p.editarProcessos || (p.cadastrarProcessos && (await processoDoConvidado(estado.processoId)))) return null;
      return "Sem permissão para alterar eventos.";
    case "arquivos":
      if (p.documentos !== "anexar") return "Sem permissão para anexar documentos.";
      if (tipo === "alterar") return "Documentos anexados não podem ser alterados.";
      if (tipo === "excluir" && estado.responsavelId !== conv.id) return "Só é possível remover documentos que você mesmo anexou.";
      return null;
    case "historico":
      return tipo === "criar" ? null : "O histórico não pode ser alterado.";
  }
}

/** Aplica UMA operação do convidado no banco do administrador. */
export async function aplicarOperacao(db: LexcoDB, op: Operacao, conv: Convidado): Promise<Resultado> {
  const base = { opId: op.id };
  if (!TABELAS_COMPARTILHADAS.includes(op.tabela) || typeof op.chave !== "string" || !op.chave) {
    return { ...base, status: "rejeitada", motivo: "Operação inválida." };
  }
  if (!["criar", "alterar", "excluir"].includes(op.tipo)) return { ...base, status: "rejeitada", motivo: "Operação inválida." };
  const tabela = db.table(op.tabela);
  const atual = (await tabela.get(op.chave)) as Record<string, unknown> | undefined;

  // Excluir algo que já não existe: nada a fazer.
  if (op.tipo === "excluir" && !atual) return { ...base, status: "aplicada", silenciosa: true };
  if (op.tipo === "alterar" && !atual) return { ...base, status: "rejeitada", motivo: "O registro foi excluído pelo administrador." };

  let negado: string | null;
  if (op.tipo === "criar") {
    negado = await permitido(db, op.tabela, "criar", conv, { ...(op.valores || {}), id: op.chave });
  } else {
    negado = await permitido(db, op.tabela, op.tipo, conv, atual!);
    // Alteração: confere também o estado DEPOIS (ex.: virar uma tarefa em audiência,
    // ou mover um prazo/vínculo para outro processo, não pode escapar da regra).
    if (!negado && op.tipo === "alterar") {
      const depois = { ...atual!, ...Object.fromEntries(Object.entries(op.campos || {}).map(([k, v]) => [k, v?.para])) };
      negado = await permitido(db, op.tabela, "alterar", conv, depois);
    }
  }
  if (negado) return { ...base, status: "rejeitada", motivo: negado, silenciosa: op.tabela === "historico" && op.tipo === "excluir" };

  if (op.tipo === "criar") {
    if (atual) return { ...base, status: "rejeitada", motivo: "Registro já existe." };
    const valores = { ...(op.valores || {}), id: op.chave } as Record<string, unknown>;
    if (op.tabela === "historico") {
      // Ninguém registra histórico em nome de outra pessoa.
      valores.usuarioId = conv.id;
      valores.usuarioNome = conv.nome;
      valores.data = typeof valores.data === "string" ? valores.data : op.em;
    }
    if (op.tabela === "processos" || op.tabela === "partes") valores.criadoPor = conv.id;
    if (op.tabela === "partes" && !conv.permissoes.verDadosPessoais) {
      // Cadastrar uma parte nova é permitido; o convidado conhece os dados que digitou.
    }
    await tabela.add(valores);
    return { ...base, status: "aplicada" };
  }

  if (op.tipo === "excluir") {
    if (op.tabela === "historico") return { ...base, status: "rejeitada", silenciosa: true };
    // Conflito: o administrador mudou o registro depois que o convidado o viu.
    const antes = (op.antes || {}) as Record<string, unknown>;
    const mudouDepois = atual && "atualizadoEm" in atual
      ? !igual(atual.atualizadoEm, antes.atualizadoEm)
      : !igual(atual, { ...antes, id: op.chave });
    if (mudouDepois) return { ...base, status: "rejeitada", motivo: "Não excluído: o registro foi atualizado por outra pessoa depois que você o viu." };
    if (op.tabela === "processos") {
      await deleteProcessoCascata(op.chave, db);
      return { ...base, status: "aplicada" };
    }
    if (op.tabela === "partes" && (await db.vinculos.where("parteId").equals(op.chave).count()) > 0) {
      return { ...base, status: "rejeitada", motivo: "A parte ainda está vinculada a processos." };
    }
    await tabela.delete(op.chave);
    return { ...base, status: "aplicada" };
  }

  // alterar: campo a campo
  if (!atual) return { ...base, status: "rejeitada", motivo: "O registro foi excluído pelo administrador." };
  if (!op.campos || typeof op.campos !== "object") return { ...base, status: "rejeitada", motivo: "Operação inválida." };
  const mudancas: Record<string, unknown> = {};
  const recusados: string[] = [];
  for (const [campo, mudanca] of Object.entries(op.campos)) {
    if (!mudanca || typeof mudanca !== "object") { recusados.push(campo); continue; }
    const { de, para } = mudanca;
    if (CAMPOS_PROTEGIDOS.has(campo)) { recusados.push(`${campo} (protegido)`); continue; }
    if (op.tabela === "processos" && CAMPOS_SENSIVEIS_PROCESSO.has(campo) && !conv.permissoes.editarSensiveis
      && atual.criadoPor !== conv.id) { recusados.push(`${campo} (dado sensível)`); continue; }
    if (op.tabela === "partes" && !conv.permissoes.verDadosPessoais && (CAMPOS_PESSOAIS as readonly string[]).includes(campo)) {
      recusados.push(`${campo} (dado pessoal)`); continue;
    }
    if (op.tabela === "historico") { recusados.push(campo); continue; }
    if (!igual(atual[campo], de)) {
      if (igual(atual[campo], para)) continue; // os dois chegaram ao mesmo valor
      recusados.push(`${campo} (alterado por outra pessoa)`);
      continue;
    }
    mudancas[campo] = para;
  }
  if (op.tabela === "processos" && Object.keys(mudancas).length) mudancas.atualizadoPor = conv.id;
  if (Object.keys(mudancas).length) {
    // Campos que deixaram de existir viram undefined (Dexie remove com update).
    await tabela.update(op.chave, Object.fromEntries(Object.entries(mudancas).map(([k, v]) => [k, v ?? undefined])));
  }
  if (!recusados.length) return { ...base, status: "aplicada" };
  return {
    ...base,
    status: Object.keys(mudancas).length ? "parcial" : "rejeitada",
    motivo: `Não aplicado: ${recusados.join(", ")}.`,
  };
}

/** Aplica um lote, em ordem; uma falha inesperada numa operação não trava as outras. */
export async function aplicarOperacoes(db: LexcoDB, ops: Operacao[], conv: Convidado): Promise<ResultadoOperacao[]> {
  const out: ResultadoOperacao[] = [];
  const em = new Date().toISOString();
  for (const op of ops) {
    let r: Resultado;
    try {
      // Cada operação grava numa única escrita (a exclusão em cascata tem a própria transação).
      r = await aplicarOperacao(db, op, conv);
    } catch (e) {
      r = { opId: op.id, status: "rejeitada", motivo: `Erro ao aplicar: ${e instanceof Error ? e.message : String(e)}` };
    }
    const { silenciosa, ...resto } = r;
    if (!silenciosa) out.push({ ...resto, em });
    else out.push({ opId: op.id, status: resto.status, em }); // registra para não reprocessar, sem motivo
  }
  return out;
}

/** Aplica uma operação pendente na cópia local do convidado (visão otimista até o administrador confirmar). */
export async function aplicarLocal(db: LexcoDB, op: Operacao) {
  const t = db.table(op.tabela);
  if (op.tipo === "criar") await t.put({ ...(op.valores || {}), id: op.chave });
  else if (op.tipo === "excluir") await t.delete(op.chave);
  else {
    const atual = await t.get(op.chave);
    if (atual) await t.update(op.chave, Object.fromEntries(Object.entries(op.campos || {}).map(([k, v]) => [k, v.para ?? undefined])));
  }
}

export type { Processo };
