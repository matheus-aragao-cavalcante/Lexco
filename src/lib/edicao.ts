/**
 * Edição do aplicativo — uma única base de código gera dois executáveis.
 *
 *  - "completa" (padrão): processos judiciais e administrativos, com escolha
 *    da modalidade em cada processo.
 *  - "spu": versão SPU/Pública, só processos administrativos (SPU), com a
 *    nomenclatura "Manifestante" no lugar de "Autor"/"Réu".
 *
 * A edição é definida no build pela variável VITE_EDICAO (ver scripts
 * "electron:build" e "electron:build:spu" no package.json).
 */
export type Edicao = "completa" | "spu";
export type Modalidade = "judicial" | "administrativo";

export interface ConfigEdicao {
  edicao: Edicao;
  nomeApp: string;
  subtitulo: string;
  /** Modalidades que o usuário pode escolher ao cadastrar um processo. */
  modalidades: Modalidade[];
  modalidadePadrao: Modalidade;
  /** Modelo de nomenclatura sugerido para novos processos. */
  modeloPadraoPorModalidade: Record<Modalidade, string>;
}

const CONFIGS: Record<Edicao, ConfigEdicao> = {
  completa: {
    edicao: "completa",
    nomeApp: "Lexco",
    subtitulo: "Gestão Jurídica",
    modalidades: ["judicial", "administrativo"],
    modalidadePadrao: "judicial",
    modeloPadraoPorModalidade: { judicial: "civel", administrativo: "administrativo" },
  },
  spu: {
    edicao: "spu",
    nomeApp: "Lexco SPU",
    subtitulo: "Processos Administrativos",
    modalidades: ["administrativo"],
    modalidadePadrao: "administrativo",
    modeloPadraoPorModalidade: { judicial: "spu", administrativo: "spu" },
  },
};

export function resolverEdicao(valor: unknown): Edicao {
  return valor === "spu" ? "spu" : "completa";
}

export const EDICAO: ConfigEdicao = CONFIGS[resolverEdicao(import.meta.env.VITE_EDICAO)];

export function configDaEdicao(edicao: Edicao): ConfigEdicao {
  return CONFIGS[edicao];
}

/** Processos antigos (sem modalidade gravada) eram todos tratados como judiciais. */
export function modalidadeDoProcesso(p: { modalidade?: Modalidade | string }): Modalidade {
  return p.modalidade === "administrativo" ? "administrativo" : "judicial";
}

/** Rótulos dos campos do processo conforme a modalidade. */
export interface RotulosProcesso {
  numero: string;
  numeroPlaceholder: string;
  classeProcessual: string;
  orgaoJulgador: string;
  comarca: string;
  tribunal: string;
  instancia: string;
  dataDistribuicao: string;
  objetoAcao: string;
  areaDireito: string;
}

const ROTULOS: Record<Modalidade, RotulosProcesso> = {
  judicial: {
    numero: "Número do Processo",
    numeroPlaceholder: "0000000-00.0000.0.00.0000",
    classeProcessual: "Classe Processual",
    orgaoJulgador: "Órgão Julgador",
    comarca: "Comarca / Vara",
    tribunal: "Tribunal",
    instancia: "Instância",
    dataDistribuicao: "Data de Distribuição",
    objetoAcao: "Objeto da Ação",
    areaDireito: "Área do Direito",
  },
  administrativo: {
    numero: "Número do Processo (SEI/SPU)",
    numeroPlaceholder: "00000.000000/0000-00",
    classeProcessual: "Tipo de Processo",
    orgaoJulgador: "Unidade Responsável",
    comarca: "Superintendência / UF",
    tribunal: "Órgão",
    instancia: "Fase",
    dataDistribuicao: "Data de Abertura",
    objetoAcao: "Objeto do Pedido",
    areaDireito: "Área / Assunto",
  },
};

export function rotulosProcesso(modalidade: Modalidade): RotulosProcesso {
  return ROTULOS[modalidade];
}

export const NOMES_MODALIDADE: Record<Modalidade, string> = {
  judicial: "Judicial",
  administrativo: "Administrativo",
};
