/**
 * Gera electron/google-config.cjs a partir do .env.local (ou variáveis de ambiente).
 * Roda antes do electron:dev / electron:build. O arquivo gerado fica fora do git.
 *
 * Chaves aceitas: CLIENT_ID / CLIENT_SECRET (formato exportado pelo Doppler)
 * ou GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
 *
 * Obs.: em apps de computador o Google não trata o client secret como confidencial
 * (ele vai dentro do instalador). O cuidado é só não publicá-lo no GitHub.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = { ...parseEnv(join(root, ".env")), ...parseEnv(join(root, ".env.local")), ...process.env };
const clientId = env.GOOGLE_CLIENT_ID || env.CLIENT_ID || "";
const clientSecret = env.GOOGLE_CLIENT_SECRET || env.CLIENT_SECRET || "";

if (!clientId || !clientSecret) {
  console.warn("[google-config] CLIENT_ID/CLIENT_SECRET não encontrados — sincronização com o Google Drive ficará desativada.");
}

writeFileSync(
  join(root, "electron", "google-config.cjs"),
  `// Gerado por scripts/gen-google-config.mjs — NÃO versionar.\nmodule.exports = ${JSON.stringify({ clientId, clientSecret }, null, 2)};\n`,
);
console.log(`[google-config] gerado (${clientId ? "com" : "sem"} credenciais).`);
