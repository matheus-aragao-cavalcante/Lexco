/**
 * Integração Google (login OAuth + Google Drive) — roda no processo principal.
 *
 * - Login: fluxo OAuth "loopback" com PKCE, no navegador padrão do sistema
 *   (o Google não permite login dentro de janelas embutidas).
 * - Tokens: só o refresh token é persistido, criptografado com safeStorage
 *   (DPAPI no Windows), em %APPDATA%/Lexco/google-auth.json. O renderer
 *   (React) nunca vê tokens; ele só chama as operações via IPC.
 * - Escopo drive.file: o app só enxerga os arquivos que ele mesmo criou.
 */
const { app, safeStorage, shell } = require("electron");
const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

let config = { clientId: "", clientSecret: "" };
try {
  config = require("./google-config.cjs");
} catch {
  // Sem credenciais geradas: integração fica desativada.
}

const SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/drive.file"];
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_NAME = "Lexco Backups";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

const isConfigured = () => Boolean(config.clientId && config.clientSecret);
const authFile = () => path.join(app.getPath("userData"), "google-auth.json");

// ---------- persistência ----------

/** @returns {{ refreshToken: string, email: string, folderId?: string } | null} */
function loadAuth() {
  try {
    const raw = JSON.parse(fs.readFileSync(authFile(), "utf8"));
    const json = raw.encrypted
      ? safeStorage.decryptString(Buffer.from(raw.data, "base64"))
      : raw.data;
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function saveAuth(auth) {
  const json = JSON.stringify(auth);
  const encrypted = safeStorage.isEncryptionAvailable();
  const data = encrypted ? safeStorage.encryptString(json).toString("base64") : json;
  fs.writeFileSync(authFile(), JSON.stringify({ encrypted, data }), { mode: 0o600 });
}

function clearAuth() {
  accessToken = null;
  try {
    fs.unlinkSync(authFile());
  } catch (e) {
    if (e.code !== "ENOENT") throw new Error("Não foi possível remover a conta Google deste computador.");
  }
}

// ---------- tokens ----------

let accessToken = null; // { token, expiresAt }

async function postToken(params, signal) {
  const res = await fetch(TOKEN_URL, {
    signal: signal ?? AbortSignal.timeout(30_000),
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...params }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error_description || body.error || `Falha no Google (HTTP ${res.status})`);
    err.code = body.error;
    throw err;
  }
  return body;
}

async function getAccessToken(forceRefresh = false) {
  if (!forceRefresh && accessToken && accessToken.expiresAt - 60_000 > Date.now()) return accessToken.token;
  const auth = loadAuth();
  if (!auth) throw new Error("Conta Google não conectada.");
  try {
    const t = await postToken({ grant_type: "refresh_token", refresh_token: auth.refreshToken });
    accessToken = { token: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 };
    return accessToken.token;
  } catch (e) {
    if (e.code === "invalid_grant") {
      clearAuth();
      throw new Error("O acesso ao Google expirou ou foi revogado. Conecte a conta novamente.");
    }
    throw e;
  }
}

/** fetch autenticado; renova o token e tenta de novo uma vez em caso de 401. */
async function gfetch(url, init = {}, retry = true) {
  const token = await getAccessToken();
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  if (res.status === 401 && retry) {
    await getAccessToken(true);
    return gfetch(url, init, false);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `Erro no Google Drive (HTTP ${res.status})`);
  }
  return res;
}

// ---------- login ----------

const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let pendingLogin = null; // { cancel(): void } — tentativa de login em andamento
let loginGeneration = 0; // incrementa a cada novo login/cancelamento/desconexão

/**
 * Sobe um servidor HTTP em 127.0.0.1 (porta aleatória) para receber o redirect do Google.
 * Resolve com a porta assim que estiver ouvindo; `code` resolve quando o usuário autorizar.
 */
function startLoopback(state) {
  return new Promise((resolveListen, rejectListen) => {
    let resolveCode, rejectCode;
    const code = new Promise((res, rej) => {
      resolveCode = res;
      rejectCode = rej;
    });
    code.catch(() => {}); // evita "unhandled rejection" se ninguém aguardar

    let done = false;
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname !== "/") {
        res.writeHead(404).end();
        return;
      }
      const received = url.searchParams.get("code");
      const ok = Boolean(received) && url.searchParams.get("state") === state;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        "<!doctype html><meta charset=\"utf-8\"><title>Lexco</title>" +
          "<body style=\"font-family:system-ui;text-align:center;padding-top:15vh\">" +
          `<h2>${ok ? "Conta Google conectada ao Lexco ✅" : "Não foi possível conectar ❌"}</h2>` +
          "<p>Você já pode fechar esta aba e voltar ao Lexco.</p></body>",
      );
      if (ok) finish(() => resolveCode(received));
      else {
        const denied = url.searchParams.get("error") === "access_denied";
        finish(() => rejectCode(new Error(denied ? "Autorização cancelada no Google." : "Resposta inválida do Google.")));
      }
    });

    const timer = setTimeout(
      () => finish(() => rejectCode(new Error("Tempo esgotado aguardando o login no Google."))),
      LOGIN_TIMEOUT_MS,
    );
    let listening = false;
    function finish(fn) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      server.close();
      fn();
    }
    const cancel = () =>
      finish(() => {
        const err = new Error("Login cancelado.");
        rejectCode(err);
        if (!listening) rejectListen(err);
      });

    server.on("error", (e) => {
      finish(() => rejectCode(e));
      rejectListen(e);
    });
    server.listen(0, "127.0.0.1", () => {
      listening = true;
      resolveListen({ port: server.address().port, code, cancel });
    });
  });
}

/**
 * Lê o perfil do id_token. Ele veio direto do endpoint de token do Google via HTTPS
 * (não de terceiros), então não é preciso validar a assinatura aqui.
 */
function profileFromIdToken(idToken) {
  try {
    const p = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return { email: String(p.email || "").toLowerCase(), emailVerified: p.email_verified === true, name: p.name || "", picture: p.picture || "" };
  } catch {
    return { email: "", emailVerified: false, name: "", picture: "" };
  }
}

/** Baixa a foto do perfil e devolve como data URL (funciona offline depois). */
async function pictureAsDataUrl(url) {
  if (!/^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\//i.test(url)) return "";
  try {
    const res = await fetch(url.replace(/=s\d+-c$/, "=s192-c"), { signal: AbortSignal.timeout(10_000) });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.startsWith("image/")) return "";
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 300_000 ? "" : `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

async function connect() {
  if (!isConfigured()) throw new Error("Integração com o Google não configurada nesta versão do Lexco.");
  pendingLogin?.cancel();
  const generation = ++loginGeneration;
  const abort = new AbortController();

  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));

  const { port, code, cancel } = await startLoopback(state);
  pendingLogin = {
    cancel: () => {
      cancel();
      abort.abort(new Error("Login cancelado."));
    },
  };
  const stillCurrent = () => generation === loginGeneration;
  const redirectUri = `http://127.0.0.1:${port}`;
  const authUrl = `${AUTH_URL}?${new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    access_type: "offline",
    prompt: "select_account consent", // escolher a conta + garantir refresh token
  })}`;
  let tokens;
  try {
    await shell.openExternal(authUrl);
    const receivedCode = await code;
    if (!stillCurrent()) throw new Error("Login cancelado.");
    tokens = await postToken(
      { grant_type: "authorization_code", code: receivedCode, redirect_uri: redirectUri, code_verifier: verifier },
      AbortSignal.any([abort.signal, AbortSignal.timeout(30_000)]),
    );
  } catch (e) {
    cancel();
    throw abort.signal.aborted ? new Error("Login cancelado.") : e;
  } finally {
    if (stillCurrent()) pendingLogin = null;
  }
  // Cancelado, substituído por outro login ou desconectado enquanto trocava o código.
  if (!stillCurrent()) throw new Error("Login cancelado.");
  if (!tokens.refresh_token) throw new Error("O Google não devolveu permissão de acesso contínuo. Tente novamente.");
  if (!String(tokens.scope || "").includes("drive.file")) {
    throw new Error("É preciso marcar a permissão do Google Drive na tela do Google para usar o backup.");
  }

  const profile = profileFromIdToken(tokens.id_token || "");
  if (!profile.email || !profile.emailVerified) throw new Error("Não foi possível confirmar o e-mail da conta Google.");

  accessToken = { token: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 };
  saveAuth({ refreshToken: tokens.refresh_token, email: profile.email, name: profile.name });
  return {
    ...status(),
    profile: { email: profile.email, name: profile.name, picture: await pictureAsDataUrl(profile.picture) },
  };
}

function cancelConnect() {
  loginGeneration++;
  pendingLogin?.cancel();
  pendingLogin = null;
}

async function disconnect() {
  cancelConnect(); // um login em andamento não pode "reconectar" depois do Desconectar
  const auth = loadAuth();
  clearAuth();
  if (auth?.refreshToken) {
    // Revoga no Google também (melhor esforço; o token local já foi apagado).
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: auth.refreshToken }),
    }).catch(() => {});
  }
  return status();
}

/** Esquece a conta neste computador sem revogar no Google (usado ao sair do app). */
function signOut() {
  cancelConnect();
  clearAuth();
  return status();
}

function status() {
  const auth = loadAuth();
  return { configured: isConfigured(), connected: Boolean(auth), email: auth?.email || "" };
}

// ---------- Drive ----------

const q = (s) => encodeURIComponent(s);

/** Pasta "Lexco Backups" na raiz do Drive (criada pelo app, então visível com drive.file). */
async function ensureFolder() {
  const auth = loadAuth();
  if (!auth) throw new Error("Conta Google não conectada.");

  if (auth.folderId) {
    const res = await gfetch(`${DRIVE_API}/files/${auth.folderId}?fields=id,trashed`).catch(() => null);
    const info = res ? await res.json() : null;
    if (info && !info.trashed) return auth.folderId;
  }

  const query = `name = '${FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and 'root' in parents and trashed = false`;
  const found = await (await gfetch(`${DRIVE_API}/files?q=${q(query)}&fields=files(id)&pageSize=1`)).json();
  let folderId = found.files?.[0]?.id;
  if (!folderId) {
    const created = await (
      await gfetch(`${DRIVE_API}/files?fields=id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
      })
    ).json();
    folderId = created.id;
  }
  // Relê antes de salvar: se desconectaram (ou trocaram de conta) no meio, não recria credenciais.
  const current = loadAuth();
  if (!current || current.refreshToken !== auth.refreshToken) throw new Error("A conta Google foi desconectada.");
  saveAuth({ ...current, folderId });
  return folderId;
}

const FILE_FIELDS = "id,name,size,createdTime";

/** Envia um backup (upload "resumable": funciona para arquivos grandes, com anexos). */
const MANTER_AUTOMATICOS = 30; // backups automáticos: 1 arquivo por dia, últimos 30 dias

/**
 * Envia um backup (upload "resumable": funciona para arquivos grandes, com anexos).
 * - manual: sempre cria um arquivo novo (nunca é apagado automaticamente);
 * - automático (`auto`): atualiza o arquivo do dia com o mesmo nome, se existir,
 *   e apaga os automáticos mais antigos que os últimos MANTER_AUTOMATICOS.
 */
async function uploadBackup(name, content, auto = false) {
  if (typeof name !== "string" || !/^[\w.\- ]{1,120}$/.test(name)) throw new Error("Nome de arquivo inválido.");
  if (typeof content !== "string") throw new Error("Conteúdo inválido.");
  if (typeof auto !== "boolean") throw new Error("Parâmetro inválido.");
  const folderId = await ensureFolder();
  const body = Buffer.from(content, "utf8");

  let existenteId = null;
  if (auto) {
    const query = `'${folderId}' in parents and name = '${name}' and trashed = false`;
    const found = await (await gfetch(`${DRIVE_API}/files?q=${q(query)}&fields=files(id)&pageSize=1`)).json();
    existenteId = found.files?.[0]?.id || null;
  }

  const init = existenteId
    ? await gfetch(`${DRIVE_UPLOAD}/files/${existenteId}?uploadType=resumable&fields=${FILE_FIELDS}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "application/json",
          "X-Upload-Content-Length": String(body.length),
        },
        body: JSON.stringify({}),
      })
    : await gfetch(`${DRIVE_UPLOAD}/files?uploadType=resumable&fields=${FILE_FIELDS}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "application/json",
          "X-Upload-Content-Length": String(body.length),
        },
        body: JSON.stringify({
          name,
          parents: [folderId],
          mimeType: "application/json",
          appProperties: { lexco: "backup", tipo: auto ? "auto" : "manual" },
        }),
      });
  const location = init.headers.get("location");
  if (!location) throw new Error("O Google Drive não iniciou o envio.");

  const res = await gfetch(location, { method: "PUT", headers: { "Content-Type": "application/json" }, body });
  const file = await res.json();
  if (auto) await podarAutomaticos(folderId).catch(() => {}); // melhor esforço
  return file;
}

/** Apaga backups automáticos além dos mais recentes (os manuais nunca são tocados). */
async function podarAutomaticos(folderId) {
  const query = `'${folderId}' in parents and trashed = false and appProperties has { key='tipo' and value='auto' }`;
  const page = await (
    await gfetch(`${DRIVE_API}/files?q=${q(query)}&orderBy=${q("createdTime desc")}&pageSize=200&fields=${q("files(id)")}`)
  ).json();
  for (const f of (page.files || []).slice(MANTER_AUTOMATICOS)) {
    await gfetch(`${DRIVE_API}/files/${f.id}`, { method: "DELETE" });
  }
}

async function listBackups() {
  const folderId = await ensureFolder();
  const query = `'${folderId}' in parents and trashed = false`;
  const out = [];
  let pageToken = "";
  do {
    const page = await (
      await gfetch(
        `${DRIVE_API}/files?q=${q(query)}&orderBy=${q("createdTime desc")}&pageSize=100` +
          `&fields=${q(`nextPageToken,files(${FILE_FIELDS})`)}${pageToken ? `&pageToken=${q(pageToken)}` : ""}`,
      )
    ).json();
    out.push(...(page.files || []));
    pageToken = page.nextPageToken || "";
  } while (pageToken);
  return out.map((f) => ({ id: f.id, name: f.name, size: Number(f.size || 0), createdTime: f.createdTime }));
}

const validId = (id) => typeof id === "string" && /^[\w-]{10,}$/.test(id);

async function downloadBackup(id) {
  if (!validId(id)) throw new Error("Arquivo inválido.");
  return (await gfetch(`${DRIVE_API}/files/${id}?alt=media`)).text();
}

async function deleteBackup(id) {
  if (!validId(id)) throw new Error("Arquivo inválido.");
  await gfetch(`${DRIVE_API}/files/${id}`, { method: "DELETE" });
}

// ---------- IPC ----------

/**
 * Registra os canais "google:*". Erros voltam como { ok:false, error } em vez de
 * exceções, para a mensagem chegar limpa ao React.
 */
function registerGoogleIpc(ipcMain, getWindow) {
  const wrap = (fn) => async (_event, ...args) => {
    try {
      return { ok: true, value: await fn(...args) };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  };
  ipcMain.handle("google:status", wrap(status));
  ipcMain.handle(
    "google:connect",
    wrap(async () => {
      const result = await connect();
      const win = getWindow();
      if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
      }
      return result;
    }),
  );
  ipcMain.handle("google:cancelConnect", wrap(cancelConnect));
  ipcMain.handle("google:disconnect", wrap(disconnect));
  ipcMain.handle("google:signOut", wrap(signOut));
  ipcMain.handle("google:upload", wrap(uploadBackup));
  ipcMain.handle("google:list", wrap(listBackups));
  ipcMain.handle("google:download", wrap(downloadBackup));
  ipcMain.handle("google:delete", wrap(deleteBackup));
}

module.exports = { registerGoogleIpc };

