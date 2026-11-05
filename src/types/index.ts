import type { Modalidade } from "@/lib/edicao";
import type { Permissoes } from "@/lib/permissoes";
export type { Modalidade } from "@/lib/edicao";

// ======= MODELOS DE NOMENCLATURA =======
export interface ModeloNomenclatura {
  id: string;
  nome: string;
  poloAtivo: string;
  poloPassivo: string;
  custom?: boolean;
  /** Modalidades em que o modelo aparece (o "Personalizado" vale para todas). */
  modalidades: Modalidade[];
}

export const MODELOS_NOMENCLATURA: ModeloNomenclatura[] = [
  { id: "civel", nome: "Cível", poloAtivo: "Autor", poloPassivo: "Réu", modalidades: ["judicial"] },
  { id: "mandado", nome: "Mandado de Segurança", poloAtivo: "Impetrante", poloPassivo: "Impetrado", modalidades: ["judicial"] },
  { id: "trabalhista", nome: "Trabalhista", poloAtivo: "Reclamante", poloPassivo: "Reclamado", modalidades: ["judicial"] },
  { id: "execucao", nome: "Execução", poloAtivo: "Exequente", poloPassivo: "Executado", modalidades: ["judicial"] },
  { id: "habeas", nome: "Habeas Corpus", poloAtivo: "Impetrante", poloPassivo: "Autoridade Coatora", modalidades: ["judicial"] },
  { id: "consumidor", nome: "Consumidor", poloAtivo: "Consumidor", poloPassivo: "Fornecedor", modalidades: ["judicial"] },
  { id: "familia", nome: "Família", poloAtivo: "Requerente", poloPassivo: "Requerido", modalidades: ["judicial"] },
  { id: "criminal", nome: "Criminal", poloAtivo: "Acusação", poloPassivo: "Acusado", modalidades: ["judicial"] },
  { id: "spu", nome: "SPU / Patrimônio da União", poloAtivo: "Manifestante", poloPassivo: "Interessado", modalidades: ["administrativo"] },
  { id: "administrativo", nome: "Administrativo", poloAtivo: "Requerente", poloPassivo: "Requerido", modalidades: ["administrativo"] },
  { id: "custom", nome: "Personalizado", poloAtivo: "Polo Ativo", poloPassivo: "Polo Passivo", custom: true, modalidades: ["judicial", "administrativo"] },
];

export function modelosDaModalidade(modalidade: Modalidade): ModeloNomenclatura[] {
  return MODELOS_NOMENCLATURA.filter((m) => m.modalidades.includes(modalidade));
}

export function modeloPorId(id?: string): ModeloNomenclatura | undefined {
  return MODELOS_NOMENCLATURA.find((m) => m.id === id);
}

// ======= ENUMS / OPTIONS =======
export const ESTADOS_CIVIS = [
  "Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)",
  "União Estável", "Separado(a)", "Outro",
] as const;

export const TIPOS_PESSOA = [
  "Pessoa Física", "Pessoa Jurídica", "Órgão Público", "Entidade", "Outro",
] as const;

export const TIPOS_ENVOLVIMENTO = [
  "Polo Ativo", "Polo Passivo", "Interessado", "Testemunha",
  "Representante Legal", "Terceiro", "Autoridade", "Servidor",
  "Órgão Julgador", "Outro",
] as const;

export const AREAS_DIREITO = [
  "Cível", "Trabalhista", "Criminal", "Tributário", "Administrativo",
  "Previdenciário", "Família e Sucessões", "Empresarial", "Ambiental",
  "Consumidor", "Constitucional", "Eleitoral", "Militar", "Outro",
] as const;

export const STATUS_PROCESSO = ["ativo", "pendente", "concluido", "arquivado"] as const;
export const PRIORIDADES = ["Baixa", "Normal", "Alta", "Urgente"] as const;
export const ESFERAS = ["Particular", "Pública", "Mista"] as const;

export const TIPOS_EVENTO = [
  "audiencia", "prazo", "reuniao", "sustentacao_oral", "diligencia",
  "protocolo", "atendimento", "despacho", "sessao", "compromisso", "tarefa", "outro",
] as const;

export const TIPO_LABELS: Record<string, string> = {
  audiencia: "Audiência", prazo: "Prazo", reuniao: "Reunião",
  sustentacao_oral: "Sustentação Oral", diligencia: "Diligência",
  protocolo: "Protocolo", atendimento: "Atendimento", despacho: "Despacho",
  sessao: "Sessão", compromisso: "Compromisso", tarefa: "Tarefa", outro: "Outro",
};

export const STATUS_TAREFA = ["pendente", "em_andamento", "concluido", "cancelado"] as const;
export const STATUS_TAREFA_LABELS: Record<typeof STATUS_TAREFA[number], string> = {
  pendente: "A fazer", em_andamento: "Em andamento", concluido: "Concluída", cancelado: "Cancelada",
};

export const MODALIDADES_EVENTO = ["Presencial", "Online", "Híbrido"] as const;

export const CATEGORIAS_ARQUIVO = [
  "Petição Inicial", "Contestação", "Recurso", "Procuração",
  "Documento Pessoal", "Comprovante", "Sentença", "Decisão",
  "Despacho", "Audiência", "Parecer", "Contrato", "Outro",
] as const;

export const UFS_BRASIL = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

// ======= ENTITIES =======
export interface User {
  id: string;
  nome: string;
  nomeSocial?: string;
  email: string;
  senha: string; // SHA-256 hash ("" quando a conta entra só pelo Google)
  /** E-mail da conta Google vinculada (login com Google). */
  contaGoogle?: string;
  cpf?: string;
  rg?: string;
  dataNascimento?: string;
  estadoCivil?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  foto?: string; // base64
  oab?: string;
  ufOab?: string;
  cargo?: string;
  especialidade?: string;
  areaAtuacao?: string;
  bio?: string;
  assinaturaDigital?: string;
  nomeEscritorio?: string;
  cnpjEscritorio?: string;
  enderecoProf?: string;
  telProf?: string;
  emailProf?: string;
  logoEscritorio?: string;
  perfil: "admin" | "advogado" | "colaborador";
  status: "ativo" | "inativo";
  observacoes?: string;
  /** Permissões individuais (sem isto, valem as do perfil). */
  permissoes?: Partial<Permissoes>;
  /** Acesso remoto a este ambiente (gerado pelo administrador ao convidar). */
  acessoRemoto?: AcessoRemoto;
  preferencias: UserPreferences;
  criadoEm: string;
  atualizadoEm: string;
}

export interface AcessoRemoto {
  /** Arquivo (no Drive do administrador) com os dados liberados para este usuário. */
  pacoteId: string;
  /** Chave AES-256 (base64url) que cifra o pacote e a caixa de alterações. */
  chave: string;
  /** Arquivo (no Drive do convidado) com as alterações feitas por ele. */
  caixaId?: string;
  /** E-mail Google do convidado (para compartilhar a pasta de documentos). */
  emailGoogle?: string;
  convidadoEm: string;
  ultimaPublicacao?: string;
  ultimaLeitura?: string;
  /** Impressão do último pacote publicado (só republica se algo mudou). */
  assinatura?: string;
  /** A pasta de documentos está compartilhada com o emailGoogle. */
  docsCompartilhados?: boolean;
  /** Ids das alterações já processadas (evita aplicar duas vezes). */
  processados?: string[];
  /** Resultado das últimas alterações (devolvido ao convidado no pacote). */
  resultados?: ResultadoOperacao[];
}

export interface ResultadoOperacao {
  opId: string;
  status: "aplicada" | "parcial" | "rejeitada";
  motivo?: string;
  em: string;
}

export interface UserPreferences {
  tema: "light" | "dark";
  corPrimaria?: string;
  corSecundaria?: string;
  nomeExibicao?: string;
  notifPrazo1Dia?: boolean;
  notifPrazoHoje?: boolean;
  notifAgenda?: boolean;
  notifPendencias?: boolean;
}

export interface Processo {
  id: string;
  titulo: string;
  numero?: string;
  areaDireito?: string;
  subarea?: string;
  classeProcessual?: string;
  assuntoPrincipal?: string;
  orgaoJulgador?: string;
  comarca?: string;
  tribunal?: string;
  vara?: string;
  instancia?: string;
  esfera?: string;
  status: typeof STATUS_PROCESSO[number];
  /** Judicial ou administrativo. Ausente em processos antigos (= judicial). */
  modalidade?: Modalidade;
  prioridade?: string;
  dataDistribuicao?: string;
  dataCadastro: string;
  dataEncerramento?: string;
  responsavelId: string;
  equipeIds: string[];
  objetoAcao?: string;
  resumoCaso?: string;
  fundamentos?: string;
  observacoes?: string;
  estrategia?: string;
  riscos?: string;
  andamento?: string;
  tags: string[];
  modeloNomenclaturaId: string;
  labelPoloAtivo: string;
  labelPoloPassivo: string;
  criadoPor: string;
  atualizadoEm: string;
  atualizadoPor: string;
}

export interface ParteInteressada {
  id: string;
  tipoPessoa: string;
  nome: string;
  nomeSocial?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  cpfCnpj?: string;
  rg?: string;
  orgaoEmissor?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  dataNascimento?: string;
  nacionalidade?: string;
  naturalidade?: string;
  estadoCivil?: string;
  profissao?: string;
  genero?: string;
  telefone?: string;
  telefone2?: string;
  email?: string;
  endereco?: string;
  cep?: string;
  cidade?: string;
  estado?: string;
  representanteLegal?: string;
  advogadoVinculado?: string;
  qualificacao?: string;
  dadosComplementares?: string;
  observacoes?: string;
  foto?: string;
  status: "ativo" | "inativo";
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface VinculoProcessoParte {
  id: string;
  processoId: string;
  parteId: string;
  tipoEnvolvimento: string;
  qualificacao?: string;
  observacao?: string;
}

export interface Evento {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: string;
  data: string;
  horaInicio?: string;
  horaFim?: string;
  processoId?: string;
  partesIds: string[];
  responsaveisIds: string[];
  local?: string;
  modalidade?: string;
  linkReuniao?: string;
  lembrete?: string;
  prioridade?: string;
  /** "em_andamento" é usado pelas tarefas (tipo "tarefa"). */
  status: "pendente" | "em_andamento" | "concluido" | "cancelado";
  observacoes?: string;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
  concluidoEm?: string;
  concluidoPor?: string;
}

export interface Prazo {
  id: string;
  titulo: string;
  descricao?: string;
  processoId?: string;
  responsavelId?: string;
  dataLimite: string;
  hora?: string;
  status: "pendente" | "cumprido" | "atrasado" | "urgente";
  prioridade?: string;
  observacao?: string;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Arquivo {
  id: string;
  nome: string;
  categoria: string;
  descricao?: string;
  tamanho?: number;
  tipo?: string;
  entidadeId: string;
  entidadeTipo: "processo" | "parte" | "evento" | "usuario";
  dados?: string; // base64 de arquivos pequenos / miniatura de fotos (data URL)
  responsavelId: string;
  criadoEm: string;
  /** Arquivo guardado no Google Drive (pasta do processo). */
  driveFileId?: string;
  /** Link para abrir no navegador (Google Drive). */
  driveLink?: string;
  /** E-mail da conta Google dona do arquivo. */
  driveDono?: string;
}

export interface HistoricoAlteracao {
  id: string;
  entidadeId: string;
  entidadeTipo: "processo" | "parte" | "evento" | "prazo" | "usuario";
  acao: string;
  descricao: string;
  usuarioId: string;
  usuarioNome: string;
  data: string;
  /** Campos alterados (antes → depois), quando a ação foi uma edição. */
  detalhes?: { campo: string; rotulo: string; de: string; para: string }[];
  /** Data a que um andamento se refere (pode ser anterior ao registro). */
  dataReferencia?: string;
}
