/**
 * Consulta automática de processos judiciais pelo número CNJ.
 *
 * Fontes públicas e gratuitas (as chamadas HTTP são feitas pelo processo
 * principal do Electron — electron/consulta.cjs):
 *  - DataJud (CNJ): classe, assuntos, órgão julgador, tribunal, grau, data de
 *    ajuizamento e movimentações. NÃO informa as partes.
 *  - DJEN (Diário de Justiça Eletrônico Nacional): partes (polo ativo/passivo)
 *    e advogados, quando houve publicação nos últimos 24 meses.
 * Processos administrativos (SPU/SEI) não têm API pública: preenchimento manual.
 */

const UF_POR_CODIGO: Record<string, string> = {
  "01": "ac", "02": "al", "03": "ap", "04": "am", "05": "ba", "06": "ce", "07": "dft", "08": "es",
  "09": "go", "10": "ma", "11": "mt", "12": "ms", "13": "mg", "14": "pa", "15": "pb", "16": "pr",
  "17": "pe", "18": "pi", "19": "rj", "20": "rn", "21": "rs", "22": "ro", "23": "rr", "24": "sc",
  "25": "se", "26": "sp", "27": "to",
};

export interface NumeroCNJ {
  digitos: string; // 20 dígitos
  formatado: string; // NNNNNNN-DD.AAAA.J.TR.OOOO
  ano: string;
  justica: string; // J
  tribunal: string; // TR
  origem: string; // OOOO
}

/** Interpreta e valida (dígito verificador, módulo 97) um número no padrão CNJ. */
export function parseNumeroCNJ(valor: string): NumeroCNJ | null {
  const d = (valor || "").replace(/\D/g, "");
  if (d.length !== 20) return null;
  const n = d.slice(0, 7), dv = d.slice(7, 9), ano = d.slice(9, 13), j = d.slice(13, 14), tr = d.slice(14, 16), o = d.slice(16, 20);
  // DV = 98 - (NNNNNNN AAAA J TR OOOO 00 mod 97), calculado em partes para não estourar.
  const mod = (s: string) => s.split("").reduce((acc, c) => (acc * 10 + Number(c)) % 97, 0);
  const calc = 98 - mod(`${n}${ano}${j}${tr}${o}00`);
  if (calc !== Number(dv)) return null;
  return { digitos: d, formatado: `${n}-${dv}.${ano}.${j}.${tr}.${o}`, ano, justica: j, tribunal: tr, origem: o };
}

/** Índice do DataJud para o tribunal do número (ex.: "api_publica_tjpe"). null = não coberto. */
export function aliasDataJud(num: NumeroCNJ): string | null {
  const { justica: j, tribunal: tr } = num;
  const uf = UF_POR_CODIGO[tr];
  switch (j) {
    case "3": return "api_publica_stj";
    case "4": return Number(tr) >= 1 && Number(tr) <= 6 ? `api_publica_trf${Number(tr)}` : null;
    case "5": return tr === "00" ? "api_publica_tst" : Number(tr) >= 1 && Number(tr) <= 24 ? `api_publica_trt${Number(tr)}` : null;
    case "6": return tr === "00" ? "api_publica_tse" : uf ? `api_publica_tre-${uf === "dft" ? "df" : uf}` : null;
    case "7": return "api_publica_stm";
    case "8": return uf ? `api_publica_tj${uf}` : null;
    case "9": return ({ "13": "api_publica_tjmmg", "21": "api_publica_tjmrs", "26": "api_publica_tjmsp" } as Record<string, string>)[tr] ?? null;
    default: return null; // STF (1) e CNJ (2) não estão no DataJud
  }
}

export interface ParteEncontrada {
  nome: string;
  polo: "ativo" | "passivo" | "outro";
  advogados: string[];
}

export interface Movimento { data: string; descricao: string }

export interface DadosEncontrados {
  numero: string;
  tribunal?: string;
  orgaoJulgador?: string;
  classeProcessual?: string;
  assuntoPrincipal?: string;
  dataDistribuicao?: string; // AAAA-MM-DD
  instancia?: string;
  comarca?: string;
  sigilo?: boolean;
  partes: ParteEncontrada[];
  movimentos: Movimento[];
  /** De onde veio cada campo (para exibir na revisão). */
  origem: Partial<Record<keyof Omit<DadosEncontrados, "origem" | "avisos" | "numero">, "DataJud" | "DJEN">>;
  avisos: string[];
}

/** "20031201000000", "2003-12-01T00:00:00.000Z" ou "2003-12-01" → "2003-12-01". */
export function dataISO(v: unknown): string | undefined {
  const s = String(v ?? "");
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return undefined;
}

const GRAUS: Record<string, string> = {
  G1: "1º Grau", G2: "2º Grau", JE: "Juizado Especial", TR: "Turma Recursal",
  TRU: "Turma Regional de Uniformização", TNU: "Turma Nacional de Uniformização", SUP: "Tribunal Superior",
};

type Json = Record<string, unknown>;
const arr = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Capitaliza nomes vindos em CAIXA ALTA ("SPRINGER CARRIER LTDA" → "Springer Carrier Ltda"). */
export function capitalizarNome(nome: string): string {
  if (!nome || nome !== nome.toUpperCase()) return nome;
  const minusculas = new Set(["de", "da", "do", "das", "dos", "e", "em", "na", "no"]);
  return nome.toLowerCase().split(/\s+/).map((p, i) =>
    i > 0 && minusculas.has(p) ? p : /^(s\/a|s\.a\.?|ltda|me|epp|eireli)$/.test(p) ? p.toUpperCase().replace("LTDA", "Ltda") : p.charAt(0).toUpperCase() + p.slice(1),
  ).join(" ");
}

/** Junta as respostas brutas das duas fontes num único resultado para revisão. */
export function normalizarConsulta(
  num: NumeroCNJ,
  datajud: { hits?: { hits?: Json[] } } | null,
  djen: { items?: Json[] } | null,
): DadosEncontrados {
  const out: DadosEncontrados = { numero: num.formatado, partes: [], movimentos: [], origem: {}, avisos: [] };

  // DataJud: pode haver mais de um registro (graus diferentes); usa o mais recente.
  const hits = arr(datajud?.hits?.hits).map((h) => obj(h._source));
  if (hits.length) {
    hits.sort((a, b) => String(b.dataHoraUltimaAtualizacao ?? "").localeCompare(String(a.dataHoraUltimaAtualizacao ?? "")));
    const s = hits[0];
    const set = <K extends keyof DadosEncontrados>(k: K, v: DadosEncontrados[K] | undefined) => {
      if (v) { out[k] = v; (out.origem as Record<string, string>)[k] = "DataJud"; }
    };
    set("tribunal", txt(s.tribunal) || undefined);
    set("orgaoJulgador", txt(obj(s.orgaoJulgador).nome) || undefined);
    set("classeProcessual", txt(obj(s.classe).nome) || undefined);
    set("assuntoPrincipal", arr(s.assuntos).map((a) => txt(a.nome)).filter(Boolean).join("; ") || undefined);
    set("dataDistribuicao", dataISO(s.dataAjuizamento));
    set("instancia", GRAUS[txt(s.grau)] || txt(s.grau) || undefined);
    if (Number(s.nivelSigilo) > 0) out.sigilo = true;
    const movs = hits.flatMap((h) => arr(h.movimentos)).map((m) => ({
      data: String(m.dataHora ?? ""),
      descricao: [txt(m.nome), ...arr(m.complementosTabelados).map((c) => txt(c.nome)).filter(Boolean)].join(" — "),
    })).filter((m) => m.descricao);
    out.movimentos = movs.sort((a, b) => b.data.localeCompare(a.data)).slice(0, 30);
  }

  // DJEN: partes e, se o DataJud não respondeu, também órgão/classe/tribunal.
  const itens = arr(djen?.items);
  if (itens.length) {
    const primeiro = itens[0];
    const setSe = <K extends "tribunal" | "orgaoJulgador" | "classeProcessual">(k: K, v: string) => {
      if (!out[k] && v) { out[k] = v; out.origem[k] = "DJEN"; }
    };
    setSe("tribunal", txt(primeiro.siglaTribunal));
    setSe("orgaoJulgador", txt(primeiro.nomeOrgao));
    setSe("classeProcessual", capitalizarNome(txt(primeiro.nomeClasse)));
    const mapa = new Map<string, ParteEncontrada>();
    for (const it of itens) {
      const advs = arr(it.destinatarioadvogados).map((a) => {
        const ad = obj(a.advogado);
        const oab = txt(ad.numero_oab) ? ` (OAB ${txt(ad.numero_oab)}/${txt(ad.uf_oab)})` : "";
        return `${capitalizarNome(txt(ad.nome))}${oab}`;
      }).filter((s) => s.trim());
      for (const d of arr(it.destinatarios)) {
        const nome = capitalizarNome(txt(d.nome));
        if (!nome) continue;
        const polo = d.polo === "A" ? "ativo" : d.polo === "P" ? "passivo" : "outro";
        const chave = `${polo}|${nome.toLowerCase()}`;
        const atual = mapa.get(chave) ?? { nome, polo, advogados: [] };
        // Advogados de uma comunicação não dizem de qual parte são; só associa se houver 1 destinatário.
        if (arr(it.destinatarios).length === 1) atual.advogados = [...new Set([...atual.advogados, ...advs])];
        mapa.set(chave, atual);
      }
    }
    out.partes = [...mapa.values()];
    if (out.partes.length) out.origem.partes = "DJEN";
  }

  if (!hits.length && !itens.length) out.avisos.push("Nenhum dado público encontrado para este número.");
  if (hits.length && !itens.length) out.avisos.push("As partes não foram encontradas (o DJEN só tem processos com publicação nos últimos 24 meses). Cadastre-as manualmente.");
  if (out.sigilo) out.avisos.push("Processo com nível de sigilo: alguns dados podem não estar disponíveis.");
  return out;
}

export interface FontesConsulta {
  datajud: (alias: string, numero: string) => Promise<unknown>;
  djen: (numero: string) => Promise<unknown>;
}

/**
 * Consulta as duas fontes em paralelo. Se uma falhar (fora do ar, sobrecarga),
 * usa o que a outra trouxe e explica o problema nos avisos.
 */
export async function consultarProcesso(numero: string, fontes: FontesConsulta): Promise<DadosEncontrados> {
  const num = parseNumeroCNJ(numero);
  if (!num) throw new Error("Número inválido. Use o padrão CNJ: 0000000-00.0000.0.00.0000 (confira os dígitos).");
  const alias = aliasDataJud(num);
  const [dj, de] = await Promise.allSettled([
    alias ? fontes.datajud(alias, num.digitos) : Promise.reject(new Error("Tribunal não coberto pelo DataJud.")),
    fontes.djen(num.digitos),
  ]);
  const r = normalizarConsulta(
    num,
    dj.status === "fulfilled" ? (dj.value as Parameters<typeof normalizarConsulta>[1]) : null,
    de.status === "fulfilled" ? (de.value as Parameters<typeof normalizarConsulta>[2]) : null,
  );
  const motivo = (x: PromiseSettledResult<unknown>) => (x.status === "rejected" ? (x.reason instanceof Error ? x.reason.message : String(x.reason)) : "");
  if (dj.status === "rejected") r.avisos.unshift(`DataJud: ${motivo(dj)}`);
  if (de.status === "rejected") r.avisos.unshift(`DJEN: ${motivo(de)}`);
  if (dj.status === "rejected" && de.status === "rejected") {
    throw new Error(`Não foi possível consultar agora. ${motivo(dj)} ${motivo(de)} Tente de novo em alguns minutos ou preencha manualmente.`);
  }
  return r;
}
