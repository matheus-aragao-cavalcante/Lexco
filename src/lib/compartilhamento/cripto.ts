/**
 * Cifra AES-256-GCM (WebCrypto) dos arquivos de troca do ambiente compartilhado.
 * Formato: "LXE1." + base64url( iv[12] | dados cifrados ). O GCM também garante
 * integridade: um arquivo adulterado (ou cifrado com outra chave) é recusado.
 */

const PREFIXO = "LXE1.";

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function deB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

/** Nova chave aleatória de 256 bits (base64url). */
export function gerarChave(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function importar(chave: string) {
  const bruta = deB64url(chave);
  if (bruta.length !== 32) throw new Error("Chave de compartilhamento inválida.");
  return crypto.subtle.importKey("raw", bruta, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function comprimir(dados: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const stream = new Blob([dados]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function descomprimir(dados: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([dados]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** JSON → texto cifrado. Primeiro byte do conteúdo: 1 = gzip, 0 = puro. */
export async function cifrar(valor: unknown, chave: string): Promise<string> {
  const puro = new TextEncoder().encode(JSON.stringify(valor));
  const gz = await comprimir(puro);
  const corpo = new Uint8Array(1 + (gz ?? puro).length);
  corpo[0] = gz ? 1 : 0;
  corpo.set(gz ?? puro, 1);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await importar(chave), corpo));
  const tudo = new Uint8Array(12 + cifrado.length);
  tudo.set(iv, 0);
  tudo.set(cifrado, 12);
  return PREFIXO + b64url(tudo);
}

export async function decifrar<T = unknown>(texto: string, chave: string): Promise<T> {
  if (!texto.startsWith(PREFIXO)) throw new Error("Arquivo de compartilhamento inválido.");
  const tudo = deB64url(texto.slice(PREFIXO.length).trim());
  let corpo: Uint8Array;
  try {
    corpo = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: tudo.subarray(0, 12) }, await importar(chave), tudo.subarray(12)));
  } catch {
    throw new Error("Não foi possível abrir os dados compartilhados (chave incorreta ou arquivo alterado).");
  }
  const conteudo = corpo[0] === 1 ? await descomprimir(corpo.subarray(1)) : corpo.subarray(1);
  return JSON.parse(new TextDecoder().decode(conteudo)) as T;
}

// ---------- códigos de pareamento ----------

export interface Convite {
  /** id do pacote (arquivo do administrador) */
  p: string;
  /** chave AES */
  k: string;
  /** id do convidado no banco do administrador */
  u: string;
  /** nome do administrador / escritório */
  n: string;
  /** e-mail Google do administrador (para os documentos) */
  e: string;
}

export interface Resposta {
  /** id da caixa de alterações (arquivo do convidado) */
  c: string;
  u: string;
}

const codificar = (prefixo: string, v: object) => `${prefixo}${b64url(new TextEncoder().encode(JSON.stringify(v)))}`;
function decodificar<T>(prefixo: string, codigo: string, campos: string[]): T {
  const limpo = (codigo || "").replace(/\s+/g, "");
  if (!limpo.startsWith(prefixo)) throw new Error("Código inválido. Copie o código completo, começando por " + prefixo);
  try {
    const v = JSON.parse(new TextDecoder().decode(deB64url(limpo.slice(prefixo.length)))) as Record<string, unknown>;
    if (campos.some((c) => typeof v[c] !== "string" || !v[c])) throw new Error();
    return v as T;
  } catch {
    throw new Error("Código incompleto ou corrompido. Copie de novo o código inteiro.");
  }
}

export const gerarCodigoConvite = (c: Convite) => codificar("LXC1-", c);
export const lerCodigoConvite = (codigo: string) => decodificar<Convite>("LXC1-", codigo, ["p", "k", "u"]);
export const gerarCodigoResposta = (r: Resposta) => codificar("LXR1-", r);
export const lerCodigoResposta = (codigo: string) => decodificar<Resposta>("LXR1-", codigo, ["c", "u"]);
