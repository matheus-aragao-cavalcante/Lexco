/**
 * Processo principal do Electron — Lexco Desktop.
 *
 * Em produção, o build do Vite (pasta dist/) é servido pelo protocolo
 * customizado "app://lexco". Isso garante:
 *   - origem fixa → o IndexedDB (Dexie) persiste sempre no mesmo lugar;
 *   - BrowserRouter funcionando (rotas desconhecidas caem no index.html).
 *
 * Em desenvolvimento (npm run electron:dev), carrega o servidor do Vite.
 */
const { app, BrowserWindow, protocol, net, shell, ipcMain } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { registerGoogleIpc } = require("./google.cjs");
const { registerConsultaIpc } = require("./consulta.cjs");

/** Servidor do Vite: só em desenvolvimento e só em endereço local (nunca no app instalado). */
function resolveDevUrl() {
  if (app.isPackaged || !process.env.ELECTRON_DEV_URL) return null;
  try {
    const u = new URL(process.env.ELECTRON_DEV_URL);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
    return u.protocol === "http:" && local ? u.origin : null;
  } catch {
    return null;
  }
}
const DEV_URL = resolveDevUrl();
const SCHEME = "app";
const HOST = "lexco";
const APP_ORIGIN = `${SCHEME}://${HOST}`;
const DIST_DIR = path.join(__dirname, "..", "dist");

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

// Uma única instância: evita dois processos disputando o mesmo banco local.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let mainWindow = null;

function registerAppProtocol() {
  protocol.handle(SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
    const filePath = path.normalize(path.join(DIST_DIR, relative));

    // Bloqueia path traversal para fora de dist/.
    if (filePath !== DIST_DIR && !filePath.startsWith(DIST_DIR + path.sep)) {
      return new Response("Forbidden", { status: 403 });
    }

    const response = relative ? await net.fetch(pathToFileURL(filePath).toString()).catch(() => null) : null;
    if (response && response.ok) return response;

    // Fallback SPA: qualquer rota do React Router devolve o index.html.
    return net.fetch(pathToFileURL(path.join(DIST_DIR, "index.html")).toString());
  });
}

function isInternalUrl(url) {
  try {
    // URL.origin é "null" para esquemas customizados (app://), então compara protocolo + host.
    const u = new URL(url);
    const origin = `${u.protocol}//${u.host}`;
    return origin === APP_ORIGIN || (DEV_URL !== null && origin === DEV_URL);
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    title: app.getName(), // "Lexco" ou "Lexco SPU" (definido no build)
    icon: path.join(__dirname, "..", "public", "favicon.ico"),
    autoHideMenuBar: true,
    backgroundColor: "#181d25", // mesma cor da tela de abertura (evita "piscar" branco)
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Links externos abrem no navegador padrão, nunca dentro do app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isInternalUrl(url)) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.loadURL(DEV_URL || `${APP_ORIGIN}/`);
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  registerAppProtocol();
  registerGoogleIpc(ipcMain, () => mainWindow);
  registerConsultaIpc(ipcMain);
  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
