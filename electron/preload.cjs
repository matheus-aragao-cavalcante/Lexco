/**
 * Preload — ponte segura entre o React (renderer) e o Electron (main).
 * Só o que estiver em `window.lexcoDesktop` fica visível para o front-end.
 * Tokens do Google nunca passam por aqui: o renderer só pede operações.
 */
const { contextBridge, ipcRenderer } = require("electron");

const call = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld("lexcoDesktop", {
  isDesktop: true,
  platform: process.platform,
  google: {
    status: call("google:status"),
    connect: call("google:connect"),
    cancelConnect: call("google:cancelConnect"),
    disconnect: call("google:disconnect"),
    signOut: call("google:signOut"),
    upload: call("google:upload"),
    list: call("google:list"),
    download: call("google:download"),
    delete: call("google:delete"),
  },
});
