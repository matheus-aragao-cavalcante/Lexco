// ======= MODELOS DE NOMENCLATURA =======
export interface ModeloNomenclatura {
  id: string;
  nome: string;
  poloAtivo: string;
  poloPassivo: string;
  custom?: boolean;
}

export const MODELOS_NOMENCLATURA: ModeloNomenclatura[] = [
  { id: "civel", nome: "Cível", poloAtivo: "Autor", poloPassivo: "Réu" },
  { id: "mandado", nome: "Mandado de Segurança", poloAtivo: "Impetrante", poloPassivo: "Impetrado" },
  { id: "trabalhista", nome: "Trabalhista", poloAtivo: "Reclamante", poloPassivo: "Reclamado" },
  { id: "execucao", nome: "Execução", poloAtivo: "Exequente", poloPassivo: "Executado" },
  { id: "habeas", nome: "Habeas Corpus", poloAtivo: "Impetrante", poloPassivo: "Autoridade Coatora" },
  { id: "administrativo", nome: "Administrativo", poloAtivo: "Requerente", poloPassivo: "Requerido" },
  { id: "consumidor", nome: "Consumidor", poloAtivo: "Consumidor", poloPassivo: "Fornecedor" },
  { id: "familia", nome: "Família", poloAtivo: "Requerente", poloPassivo: "Requerido" },
  { id: "criminal", nome: "Criminal", poloAtivo: "Acusação", poloPassivo: "Acusado" },
  { id: "custom", nome: "Personalizado", poloAtivo: "Polo Ativo", poloPassivo: "Polo Passivo", custom: true },
];

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
  "protocolo", "atendimento", "despacho", "sessao", "compromisso", "outro",
] as const;

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
  preferencias: UserPreferences;
  criadoEm: string;
  atualizadoEm: string;
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
  status: "pendente" | "concluido" | "cancelado";
  observacoes?: string;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
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
  dados?: string; // base64 for small files
  responsavelId: string;
  criadoEm: string;
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
}
