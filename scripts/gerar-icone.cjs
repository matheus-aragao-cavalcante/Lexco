/**
 * Gera public/favicon.ico (16–256 px, quadrado) a partir de assets/icone.png.
 * Usa o canvas do Chromium via Electron — sem dependências extras.
 *
 *   npm run icone            (ou: npx electron scripts/gerar-icone.cjs [origem.png])
 *
 * A imagem é centralizada num quadrado transparente, com uma pequena margem.
 * Quanto maior a imagem de origem (ideal: 512 px ou mais), mais nítido fica.
 */
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const ORIGEM = path.resolve(process.argv.find((a) => a.endsWith(".png")) || path.join(ROOT, "assets", "icone.png"));
const DESTINO = path.join(ROOT, "public", "favicon.ico");
const TAMANHOS = [16, 24, 32, 48, 64, 128, 256];
const MARGEM = 0.06; // 6% de respiro em cada lado

/** Monta um .ico com entradas PNG (formato aceito pelo Windows Vista+). */
function montarIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // tipo: ícone
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o); // 0 = 256
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4); // planos
    dir.writeUInt16LE(32, o + 6); // bits por pixel
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

app.whenReady().then(async () => {
  try {
    if (!fs.existsSync(ORIGEM)) throw new Error(`Imagem de origem não encontrada: ${ORIGEM}`);
    const dataUrl = `data:image/png;base64,${fs.readFileSync(ORIGEM).toString("base64")}`;
    const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
    await win.loadURL("data:text/html,<html><body></body></html>");

    const resultados = await win.webContents.executeJavaScript(`
      (async () => {
        const img = new Image();
        img.src = ${JSON.stringify(dataUrl)};
        await img.decode();
        const out = [];
        for (const size of ${JSON.stringify(TAMANHOS)}) {
          const c = document.createElement("canvas");
          c.width = c.height = size;
          const ctx = c.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          const area = size * (1 - 2 * ${MARGEM});
          const escala = Math.min(area / img.width, area / img.height);
          const w = img.width * escala, h = img.height * escala;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          out.push({ size, b64: c.toDataURL("image/png").split(",")[1] });
        }
        return { out, w: img.width, h: img.height };
      })()
    `);

    const pngs = resultados.out.map(({ size, b64 }) => ({ size, data: Buffer.from(b64, "base64") }));
    fs.writeFileSync(DESTINO, montarIco(pngs));
    console.log(`[icone] ${path.basename(ORIGEM)} (${resultados.w}x${resultados.h}) → public/favicon.ico [${TAMANHOS.join(", ")}]`);
    if (Math.max(resultados.w, resultados.h) < 256) {
      console.warn("[icone] Aviso: a imagem de origem é menor que 256 px; os tamanhos grandes ficam menos nítidos.");
    }
    app.exit(0);
  } catch (e) {
    console.error("[icone] Falhou:", e.message);
    app.exit(1);
  }
});
