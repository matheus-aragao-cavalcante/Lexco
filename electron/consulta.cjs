/**
 * Consulta pública de processos (processo principal — evita CORS no app).
 *
 * Só fala com dois endereços oficiais e gratuitos:
 *  - DataJud/CNJ: https://api-publica.datajud.cnj.jus.br (chave pública do CNJ)
 *  - DJEN/CNJ:    https://comunicaapi.pje.jus.br (sem chave)
 * A interpretação das respostas fica no React (src/lib/consultaProcesso.ts).
 */

// Chave PÚBLICA divulgada pelo CNJ na wiki do DataJud (pode ser trocada pelo CNJ:
// nesse caso o DataJud passa a responder 401 e basta atualizar aqui).
const DATAJUD_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const DATAJUD_URL = "https://api-publica.datajud.cnj.jus.br";
const DJEN_URL = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";
const TENTATIVAS = 3;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Tenta de novo em sobrecarga (429/5xx/falha parcial de shards) ou queda de rede. */
async function comTentativas(fn) {
  let ultimoErro;
  for (let i = 0; i < TENTATIVAS; i++) {
    try {
      return await fn();
    } catch (e) {
      ultimoErro = e;
      if (e.definitivo) break;
      await espera(1500 * (i + 1));
    }
  }
  throw ultimoErro;
}

function erro(msg, definitivo = false) {
  const e = new Error(msg);
  e.definitivo = definitivo;
  return e;
}

async function consultarDataJud(alias, numero) {
  if (!/^api_publica_[a-z0-9-]{2,12}$/.test(String(alias))) throw erro("Tribunal inválido.", true);
  if (!/^\d{20}$/.test(String(numero))) throw erro("Número inválido.", true);
  return comTentativas(async () => {
    let res;
    try {
      res = await fetch(`${DATAJUD_URL}/${alias}/_search`, {
        method: "POST",
        signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `APIKey ${DATAJUD_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ size: 5, query: { match: { numeroProcesso: numero } } }),
      });
    } catch {
      throw erro("O DataJud não respondeu (sem conexão ou servidor lento).");
    }
    if (res.status === 401 || res.status === 403) throw erro("A chave pública do DataJud foi alterada pelo CNJ. Atualize o Lexco.", true);
    if (res.status === 404) throw erro("Tribunal não disponível no DataJud.", true);
    if (!res.ok) throw erro(`O DataJud está instável no momento (HTTP ${res.status}).`);
    const body = await res.json();
    const hits = body?.hits?.hits ?? [];
    // Servidor sobrecarregado: parte dos "shards" falha e o processo pode não aparecer.
    if (!hits.length && body?._shards?.failed > 0) throw erro("O DataJud está sobrecarregado no momento.");
    return body;
  });
}

async function consultarDJEN(numero) {
  if (!/^\d{20}$/.test(String(numero))) throw erro("Número inválido.", true);
  return comTentativas(async () => {
    let res;
    try {
      res = await fetch(`${DJEN_URL}?numeroProcesso=${numero}&itensPorPagina=50`, { signal: AbortSignal.timeout(25_000) });
    } catch {
      throw erro("O DJEN não respondeu (sem conexão ou servidor lento).");
    }
    if (res.status === 403) throw erro("O DJEN recusou o acesso (ele só aceita conexões do Brasil).", true);
    if (!res.ok) throw erro(`O DJEN está instável no momento (HTTP ${res.status}).`);
    return res.json();
  });
}

function registerConsultaIpc(ipcMain) {
  const wrap = (fn) => async (_e, ...args) => {
    try {
      return { ok: true, value: await fn(...args) };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  };
  ipcMain.handle("consulta:datajud", wrap(consultarDataJud));
  ipcMain.handle("consulta:djen", wrap(consultarDJEN));
}

module.exports = { registerConsultaIpc };
