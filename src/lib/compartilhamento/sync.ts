import { LexcoDB } from "@/lib/db";
import { permissoesDe, type Permissoes } from "@/lib/permissoes";
import type { AcessoRemoto, ResultadoOperacao, User } from "@/types";
import {
  cifrar, decifrar, gerarChave, gerarCodigoConvite, gerarCodigoResposta, lerCodigoConvite, lerCodigoResposta,
} from "./cripto";
import { aplicarOperacoes, instalarCaptura, type Operacao } from "./operacoes";
import { aplicarPacoteLocal, construirPacote, type Caixa, type Pacote } from "./pacote";

/** Operações de Drive usadas aqui (no app: electron/google.cjs; nos testes: um Drive em memória). */
export interface DriveTroca {
  publicar(id: string | null, nome: string, conteudo: string): Promise<string>;
  ler(id: string): Promise<string>;
  remover(id: string): Promise<void>;
  /** Libera/retira a pasta de documentos para o e-mail do convidado. */
  compartilharDocumentos?(email: string, permitir: boolean): Promise<unknown>;
}

export class AcessoRevogadoError extends Error {
  constructor() {
    super("O administrador encerrou o seu acesso a este ambiente.");
  }
}

const MAX_PROCESSADOS = 5000;
// Mesmo limite: toda operação processada precisa ter o resultado devolvido ao convidado.
const MAX_RESULTADOS = MAX_PROCESSADOS;

async function hash(texto: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(d)).slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ======================================================= ADMINISTRADOR

export interface Dono { nome: string; email: string; escritorio?: string }

/** Cria o pacote do convidado no Drive e devolve o código de convite. */
export async function convidarUsuario(db: LexcoDB, drive: DriveTroca, userId: string, dono: Dono, emailGoogle?: string): Promise<string> {
  const user = await db.users.get(userId);
  if (!user) throw new Error("Usuário não encontrado.");
  if (user.perfil === "admin") throw new Error("O administrador já tem acesso total; convide outro usuário.");
  if (user.status !== "ativo") throw new Error("Ative o usuário antes de convidar.");
  // Reconvite: aproveita o arquivo e troca a chave (o código antigo deixa de funcionar).
  const chave = gerarChave();
  const anterior = user.acessoRemoto;
  const pacote = await construirPacote(db, user, dono, []);
  const pacoteId = await drive.publicar(anterior?.pacoteId ?? null, `lexco_pacote_${user.id.slice(0, 8)}`, await cifrar(pacote, chave));
  const acesso: AcessoRemoto = {
    pacoteId, chave, convidadoEm: new Date().toISOString(),
    emailGoogle: emailGoogle || user.contaGoogle || user.email,
    ultimaPublicacao: pacote.geradoEm, processados: anterior?.processados ?? [], resultados: anterior?.resultados ?? [],
  };
  // E-mail mudou no reconvite: tira a pasta de documentos do e-mail antigo.
  if (drive.compartilharDocumentos && anterior?.emailGoogle && anterior.docsCompartilhados && anterior.emailGoogle !== acesso.emailGoogle) {
    await drive.compartilharDocumentos(anterior.emailGoogle, false).catch(() => {});
  }
  acesso.docsCompartilhados = await ajustarDocumentos(drive, user, acesso, anterior?.emailGoogle === acesso.emailGoogle && !!anterior?.docsCompartilhados);
  await db.users.update(userId, { acessoRemoto: acesso });
  return gerarCodigoConvite({ p: pacoteId, k: chave, u: user.id, n: dono.escritorio || dono.nome, e: dono.email });
}

/** Administrador cola o código de resposta do convidado: a partir daí recebe as alterações dele. */
export async function registrarResposta(db: LexcoDB, codigo: string): Promise<User> {
  const r = lerCodigoResposta(codigo);
  const user = await db.users.get(r.u);
  if (!user?.acessoRemoto) throw new Error("Este código não corresponde a nenhum convite ativo deste computador.");
  await db.users.update(user.id, { acessoRemoto: { ...user.acessoRemoto, caixaId: r.c } });
  return (await db.users.get(user.id))!;
}

export async function revogarAcesso(db: LexcoDB, drive: DriveTroca, userId: string) {
  const user = await db.users.get(userId);
  const acesso = user?.acessoRemoto;
  if (!user || !acesso) return;
  // Apagar o pacote é o que corta o acesso: sem ele o convidado não recebe mais nada.
  await drive.remover(acesso.pacoteId);
  if (drive.compartilharDocumentos && acesso.emailGoogle) await drive.compartilharDocumentos(acesso.emailGoogle, false);
  await db.users.update(userId, { acessoRemoto: undefined });
}

/** Mantém a pasta de documentos compartilhada SÓ enquanto a permissão de documentos existir. */
async function ajustarDocumentos(drive: DriveTroca, user: User, acesso: AcessoRemoto, atual: boolean): Promise<boolean> {
  const deve = permissoesDe(user).documentos !== "nenhum" && user.status === "ativo";
  if (!drive.compartilharDocumentos || !acesso.emailGoogle || deve === atual) return atual;
  try {
    await drive.compartilharDocumentos(acesso.emailGoogle, deve);
    return deve;
  } catch {
    return atual; // tenta de novo no próximo ciclo
  }
}

export interface ResumoSync { convidados: number; aplicadas: number; rejeitadas: number; publicados: number; erros: string[] }

/**
 * Um ciclo do administrador: lê as alterações de cada convidado, aplica o que é
 * permitido e republica o pacote de quem precisa (dados mudaram ou há resultados novos).
 */
export async function sincronizarComoDono(db: LexcoDB, drive: DriveTroca, dono: Dono): Promise<ResumoSync> {
  const resumo: ResumoSync = { convidados: 0, aplicadas: 0, rejeitadas: 0, publicados: 0, erros: [] };
  const convidados = (await db.users.toArray()).filter((u) => u.acessoRemoto);
  for (const user of convidados) {
    if (user.status !== "ativo") {
      await revogarAcesso(db, drive, user.id).catch((e) => resumo.erros.push(`${user.nome}: ${e.message}`));
      continue;
    }
    resumo.convidados++;
    try {
      let acesso = user.acessoRemoto!;
      let novosResultados: ResultadoOperacao[] = [];
      if (acesso.caixaId) {
        let caixa: Caixa | null = null;
        try {
          caixa = await decifrar<Caixa>(await drive.ler(acesso.caixaId), acesso.chave);
        } catch (e) {
          if (!(e instanceof Error && e.message === "REMOVIDO")) throw e;
        }
        if (caixa && caixa.formato === "lexco-caixa" && caixa.voceId === user.id) {
          const vistos = new Set(acesso.processados || []);
          const novas = (caixa.ops || []).filter((op) => op && typeof op.id === "string" && !vistos.has(op.id));
          if (novas.length) {
            const perms: Permissoes = permissoesDe(user);
            novosResultados = await aplicarOperacoes(db, novas, { id: user.id, nome: user.nome, permissoes: perms });
            resumo.aplicadas += novosResultados.filter((r) => r.status !== "rejeitada").length;
            resumo.rejeitadas += novosResultados.filter((r) => r.status === "rejeitada").length;
            acesso = {
              ...acesso,
              processados: [...(acesso.processados || []), ...novas.map((o) => o.id)].slice(-MAX_PROCESSADOS),
              resultados: [...(acesso.resultados || []), ...novosResultados].slice(-MAX_RESULTADOS),
              ultimaLeitura: new Date().toISOString(),
            };
          }
        }
      }
      const atual = { ...(await db.users.get(user.id))!, acessoRemoto: acesso };
      acesso = { ...acesso, docsCompartilhados: await ajustarDocumentos(drive, atual, acesso, !!acesso.docsCompartilhados) };
      const pacote = await construirPacote(db, atual, dono, acesso.resultados || []);
      const assinatura = await hash(JSON.stringify({ d: pacote.dados, r: pacote.resultados, p: pacote.permissoes, v: pacote.voce }));
      if (assinatura !== acesso.assinatura) {
        await drive.publicar(acesso.pacoteId, `lexco_pacote_${user.id.slice(0, 8)}`, await cifrar(pacote, acesso.chave));
        acesso = { ...acesso, ultimaPublicacao: pacote.geradoEm, assinatura };
        resumo.publicados++;
      }
      await db.users.update(user.id, { acessoRemoto: acesso });
    } catch (e) {
      resumo.erros.push(`${user.nome}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return resumo;
}

// ======================================================= CONVIDADO

export interface AmbienteSalvo {
  id: string; // = id do pacote
  chave: string;
  caixaId: string;
  voceId: string;
  voceNome: string;
  donoNome: string;
  donoEmail: string;
  entrouEm: string;
  ultimaSync?: string;
  /** Atualizados a cada sincronização (vêm do pacote). */
  permissoes?: Permissoes;
  perfil?: User["perfil"];
}

const chaveAmbientes = (localUserId: string) => `lexco_ambientes_${localUserId}`;
const chaveOps = (ambId: string) => `lexco_ops_${ambId}`;

export function listarAmbientes(localUserId: string): AmbienteSalvo[] {
  try {
    return JSON.parse(localStorage.getItem(chaveAmbientes(localUserId)) || "[]");
  } catch {
    return [];
  }
}

function salvarAmbientes(localUserId: string, lista: AmbienteSalvo[]) {
  localStorage.setItem(chaveAmbientes(localUserId), JSON.stringify(lista));
}

export function atualizarAmbiente(localUserId: string, amb: AmbienteSalvo) {
  salvarAmbientes(localUserId, [...listarAmbientes(localUserId).filter((a) => a.id !== amb.id), amb]);
}

export const opsPendentes = (ambId: string): Operacao[] => {
  try {
    return JSON.parse(localStorage.getItem(chaveOps(ambId)) || "[]");
  } catch {
    return [];
  }
};
export const adicionarOp = (ambId: string, op: Operacao) =>
  localStorage.setItem(chaveOps(ambId), JSON.stringify([...opsPendentes(ambId), op]));
const removerOps = (ambId: string, ids: Set<string>) =>
  localStorage.setItem(chaveOps(ambId), JSON.stringify(opsPendentes(ambId).filter((o) => !ids.has(o.id))));

export const nomeBancoAmbiente = (ambId: string) => `lexco-amb-${ambId}`;

/** Abre (ou cria) a cópia local do ambiente, com a captura de alterações ligada. */
export function abrirBancoAmbiente(amb: AmbienteSalvo): LexcoDB {
  const banco = new LexcoDB(nomeBancoAmbiente(amb.id));
  instalarCaptura(banco, (op) => adicionarOp(amb.id, op));
  return banco;
}

/** Convidado cola o código do administrador. Devolve o código de resposta. */
export async function aceitarConvite(drive: DriveTroca, localUserId: string, codigo: string) {
  const c = lerCodigoConvite(codigo);
  let pacote: Pacote;
  try {
    pacote = await decifrar<Pacote>(await drive.ler(c.p), c.k);
  } catch (e) {
    if (e instanceof Error && e.message === "REMOVIDO") throw new Error("Este convite não está mais ativo. Peça um novo ao administrador.");
    throw e;
  }
  if (pacote.formato !== "lexco-pacote" || pacote.voce.id !== c.u) throw new Error("Convite inválido.");
  const existente = listarAmbientes(localUserId).find((a) => a.id === c.p);
  const caixa: Caixa = { formato: "lexco-caixa", versao: 1, voceId: c.u, enviadoEm: new Date().toISOString(), ops: [] };
  const caixaId = await drive.publicar(existente?.caixaId ?? null, `lexco_caixa_${c.u.slice(0, 8)}`, await cifrar(caixa, c.k));
  const amb: AmbienteSalvo = {
    id: c.p, chave: c.k, caixaId, voceId: c.u, voceNome: pacote.voce.nome,
    donoNome: c.n || pacote.dono.escritorio || pacote.dono.nome, donoEmail: c.e || pacote.dono.email,
    entrouEm: new Date().toISOString(),
  };
  atualizarAmbiente(localUserId, amb);
  return { ambiente: amb, pacote, codigoResposta: gerarCodigoResposta({ c: caixaId, u: c.u }) };
}

export function removerAmbienteLocal(localUserId: string, ambId: string) {
  salvarAmbientes(localUserId, listarAmbientes(localUserId).filter((a) => a.id !== ambId));
  localStorage.removeItem(chaveOps(ambId));
  return new LexcoDB(nomeBancoAmbiente(ambId)).delete();
}

/**
 * Um ciclo do convidado: envia as alterações pendentes e baixa o pacote atual.
 * Devolve as operações recusadas pelo administrador (para avisar o usuário).
 */
export async function sincronizarComoConvidado(db: LexcoDB, drive: DriveTroca, amb: AmbienteSalvo) {
  const pendentes = opsPendentes(amb.id);
  if (pendentes.length) {
    const caixa: Caixa = { formato: "lexco-caixa", versao: 1, voceId: amb.voceId, enviadoEm: new Date().toISOString(), ops: pendentes };
    await drive.publicar(amb.caixaId, `lexco_caixa_${amb.voceId.slice(0, 8)}`, await cifrar(caixa, amb.chave));
  }
  let pacote: Pacote;
  try {
    pacote = await decifrar<Pacote>(await drive.ler(amb.id), amb.chave);
  } catch (e) {
    if (e instanceof Error && e.message === "REMOVIDO") throw new AcessoRevogadoError();
    throw e;
  }
  const porId = new Map(pacote.resultados.map((r) => [r.opId, r]));
  const confirmadas = pendentes.filter((o) => porId.has(o.id));
  removerOps(amb.id, new Set(confirmadas.map((o) => o.id)));
  const recusadas = confirmadas.map((o) => ({ op: o, resultado: porId.get(o.id)! })).filter((x) => x.resultado.status !== "aplicada" && x.resultado.motivo);
  await aplicarPacoteLocal(db, pacote, opsPendentes(amb.id));
  return { pacote, recusadas, enviadas: pendentes.length };
}
