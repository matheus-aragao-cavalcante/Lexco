import { db } from "@/lib/db";
import { rotulosProcesso, modalidadeDoProcesso, NOMES_MODALIDADE } from "@/lib/edicao";
import { modeloPorId, type HistoricoAlteracao, type Processo } from "@/types";

/**
 * Edição segura de processos:
 *  - só os campos que o usuário mexeu são gravados (não sobrescreve o resto);
 *  - se outra pessoa/janela mudou o MESMO campo desde que a tela foi aberta,
 *    o salvamento é interrompido com a lista de conflitos para o usuário decidir;
 *  - cada salvamento gera uma entrada no histórico com "campo: antes → depois".
 */

export type Detalhe = NonNullable<HistoricoAlteracao["detalhes"]>[number];

/** Campos editáveis do processo (texto) e seus rótulos. */
export function camposProcesso(p: Pick<Processo, "modalidade">): { campo: keyof Processo; rotulo: string }[] {
  const r = rotulosProcesso(modalidadeDoProcesso(p));
  return [
    { campo: "titulo", rotulo: "Título" },
    { campo: "numero", rotulo: r.numero },
    { campo: "modalidade", rotulo: "Modalidade" },
    { campo: "modeloNomenclaturaId", rotulo: "Nomenclatura das partes" },
    { campo: "areaDireito", rotulo: r.areaDireito },
    { campo: "classeProcessual", rotulo: r.classeProcessual },
    { campo: "assuntoPrincipal", rotulo: "Assunto Principal" },
    { campo: "orgaoJulgador", rotulo: r.orgaoJulgador },
    { campo: "comarca", rotulo: r.comarca },
    { campo: "tribunal", rotulo: r.tribunal },
    { campo: "vara", rotulo: "Vara" },
    { campo: "instancia", rotulo: r.instancia },
    { campo: "esfera", rotulo: "Esfera" },
    { campo: "status", rotulo: "Status" },
    { campo: "prioridade", rotulo: "Prioridade" },
    { campo: "dataDistribuicao", rotulo: r.dataDistribuicao },
    { campo: "dataEncerramento", rotulo: "Data de Encerramento" },
    { campo: "responsavelId", rotulo: "Responsável" },
    { campo: "objetoAcao", rotulo: r.objetoAcao },
    { campo: "resumoCaso", rotulo: "Resumo do Caso" },
    { campo: "fundamentos", rotulo: "Fundamentos" },
    { campo: "estrategia", rotulo: "Estratégia" },
    { campo: "riscos", rotulo: "Riscos" },
    { campo: "observacoes", rotulo: "Observações Internas" },
    { campo: "andamento", rotulo: "Andamento" },
  ];
}

const txt = (v: unknown) => (v === undefined || v === null ? "" : String(v));

/** Campos em que `depois` difere de `antes` (comparação textual; vazio = ausente). */
export function diferencas(antes: Partial<Processo>, depois: Partial<Record<string, unknown>>, campos = camposProcesso(antes)): Detalhe[] {
  const out: Detalhe[] = [];
  for (const { campo, rotulo } of campos) {
    if (!(campo in depois)) continue;
    const de = txt(antes[campo]);
    const para = txt(depois[campo]);
    if (de !== para) out.push({ campo, rotulo, de, para });
  }
  return out;
}

export interface Conflito {
  campo: string;
  rotulo: string;
  meu: string;
  atual: string;
}

export class ConflitoEdicaoError extends Error {
  constructor(public conflitos: Conflito[], public atual: Processo, public atualizadoPorNome?: string) {
    super("Outra pessoa alterou os mesmos campos enquanto você editava.");
  }
}

export interface Autor { id: string; nome: string }

/**
 * Salva as alterações de `form` feitas a partir de `base` (o processo como estava
 * quando a edição começou). Mudanças de outras pessoas em campos que o usuário NÃO
 * mexeu são preservadas; mudanças nos mesmos campos geram ConflitoEdicaoError.
 */
export async function salvarProcesso(base: Processo, form: Record<string, string>, autor: Autor): Promise<{ processo: Processo; detalhes: Detalhe[]; mesclou: boolean }> {
  return db.transaction("rw", [db.processos, db.historico, db.users, db.vinculos], async () => {
    const atual = await db.processos.get(base.id);
    if (!atual) throw new Error("O processo não existe mais (foi excluído em outro lugar).");

    const campos = camposProcesso({ modalidade: (form.modalidade || base.modalidade) as Processo["modalidade"] });
    const minhas = diferencas(base, form, campos);
    if (minhas.length === 0) return { processo: atual, detalhes: [], mesclou: false };

    const delesSet = new Set(diferencas(base, atual as unknown as Record<string, unknown>, campos).map((d) => d.campo));
    const conflitos: Conflito[] = minhas
      .filter((d) => delesSet.has(d.campo) && txt(atual[d.campo as keyof Processo]) !== d.para)
      .map((d) => ({ campo: d.campo, rotulo: d.rotulo, meu: d.para, atual: txt(atual[d.campo as keyof Processo]) }));
    if (conflitos.length > 0) {
      const quem = atual.atualizadoPor ? (await db.users.get(atual.atualizadoPor))?.nome : undefined;
      throw new ConflitoEdicaoError(conflitos, atual, quem);
    }

    const agora = new Date().toISOString();
    const atualizado: Processo = { ...atual, atualizadoEm: agora, atualizadoPor: autor.id };
    for (const d of minhas) {
      (atualizado as unknown as Record<string, unknown>)[d.campo] = d.para === "" ? undefined : d.para;
    }
    // Nova nomenclatura (ex.: judicial → administrativo): atualiza os rótulos dos polos
    // e o papel das partes que estavam nos polos antigos.
    const modelo = minhas.some((d) => d.campo === "modeloNomenclaturaId") ? modeloPorId(atualizado.modeloNomenclaturaId) : undefined;
    if (modelo && !modelo.custom) {
      const antigos = { [atual.labelPoloAtivo]: modelo.poloAtivo, [atual.labelPoloPassivo]: modelo.poloPassivo };
      atualizado.labelPoloAtivo = modelo.poloAtivo;
      atualizado.labelPoloPassivo = modelo.poloPassivo;
      await db.vinculos.where("processoId").equals(base.id).modify((v) => {
        if (v.tipoEnvolvimento in antigos) v.tipoEnvolvimento = antigos[v.tipoEnvolvimento];
      });
    }
    await db.processos.put(atualizado);

    const detalhes = await legiveis(minhas);
    const resumo = detalhes.length === 1
      ? `${detalhes[0].rotulo} atualizado`
      : `${detalhes.length} campos atualizados: ${detalhes.map((d) => d.rotulo).join(", ")}`;
    await db.historico.add({
      id: crypto.randomUUID(), entidadeId: base.id, entidadeTipo: "processo", acao: "edicao",
      descricao: resumo, usuarioId: autor.id, usuarioNome: autor.nome, data: agora, detalhes,
    });
    return { processo: atualizado, detalhes, mesclou: delesSet.size > 0 };
  });
}

/** Troca ids/códigos por textos legíveis no histórico (responsável, modalidade). */
async function legiveis(ds: Detalhe[]): Promise<Detalhe[]> {
  return Promise.all(ds.map(async (d) => {
    if (d.campo === "responsavelId") {
      const nome = async (id: string) => (id ? (await db.users.get(id))?.nome || id : "");
      return { ...d, de: await nome(d.de), para: await nome(d.para) };
    }
    if (d.campo === "modeloNomenclaturaId") {
      const n = (v: string) => { const m = modeloPorId(v); return m ? `${m.nome} (${m.poloAtivo} / ${m.poloPassivo})` : v; };
      return { ...d, de: n(d.de), para: n(d.para) };
    }
    if (d.campo === "modalidade") {
      const n = (v: string) => (v ? NOMES_MODALIDADE[v as keyof typeof NOMES_MODALIDADE] || v : "Judicial");
      return { ...d, de: n(d.de), para: n(d.para) };
    }
    return d;
  }));
}

/**
 * Quando o processo é recarregado no meio de uma edição: mantém o que o usuário
 * alterou e atualiza os demais campos com os valores novos do banco.
 */
export function rebasearFormulario(baseAntiga: Processo, novo: Processo, form: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...form };
  for (const { campo } of camposProcesso(novo)) {
    const mexeu = txt(form[campo]) !== txt(baseAntiga[campo]);
    if (!mexeu) out[campo] = txt(novo[campo]);
  }
  return out;
}

/**
 * Base de comparação após recarregar no meio de uma edição: campos que o usuário
 * mexeu mantêm o valor ORIGINAL (para o conflito continuar sendo detectado);
 * os demais passam a refletir o banco.
 */
export function rebasearBase(baseAntiga: Processo, novo: Processo, form: Record<string, string>): Processo {
  const out = { ...novo } as unknown as Record<string, unknown>;
  for (const { campo } of camposProcesso(novo)) {
    if (txt(form[campo]) !== txt(baseAntiga[campo])) out[campo] = baseAntiga[campo];
  }
  return out as unknown as Processo;
}

/** Registra um andamento (atualização de acompanhamento) no histórico do processo. */
export async function registrarAndamento(processoId: string, texto: string, dataReferencia: string, autor: Autor) {
  const agora = new Date().toISOString();
  await db.transaction("rw", [db.processos, db.historico], async () => {
    await db.historico.add({
      id: crypto.randomUUID(), entidadeId: processoId, entidadeTipo: "processo", acao: "andamento",
      descricao: texto.trim(), usuarioId: autor.id, usuarioNome: autor.nome, data: agora,
      dataReferencia: dataReferencia || undefined,
    });
    // Só marca a data de atualização; não mexe nos demais campos.
    await db.processos.update(processoId, { atualizadoEm: agora, atualizadoPor: autor.id });
  });
}

