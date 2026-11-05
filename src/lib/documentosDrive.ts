import { db, addHistorico } from "@/lib/db";
import { googleDrive, getDesktopGoogle } from "@/lib/googleDrive";
import type { Arquivo, Processo } from "@/types";

/**
 * Documentos e fotos dos processos guardados no Google Drive, organizados em
 * "<Lexco> Documentos/<número - título>/". No banco local fica só o registro
 * (nome, categoria, link e uma miniatura pequena das fotos) — assim o backup
 * continua leve e os arquivos ficam no Drive, com a lixeira do Google.
 */

export const LIMITE_MB = 50;

export const nomePastaProcesso = (p: Pick<Processo, "numero" | "titulo">) =>
  [p.numero, p.titulo].filter(Boolean).join(" - ").slice(0, 120) || "Processo";

/** Miniatura JPEG (máx. 240 px) para mostrar fotos sem baixar do Drive. */
export async function gerarMiniatura(arquivo: File): Promise<string | undefined> {
  if (!arquivo.type.startsWith("image/") || typeof createImageBitmap !== "function") return undefined;
  try {
    const img = await createImageBitmap(arquivo);
    const escala = Math.min(1, 240 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * escala));
    canvas.height = Math.max(1, Math.round(img.height * escala));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.close();
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return undefined;
  }
}

export function driveDisponivel() {
  return !!getDesktopGoogle();
}

export async function anexarDocumento(opts: {
  processo: Pick<Processo, "id" | "numero" | "titulo">;
  arquivo: File;
  categoria: string;
  descricao?: string;
  autor: { id: string; nome: string };
  /** No ambiente compartilhado: e-mail do administrador, que recebe acesso de leitura. */
  compartilharCom?: string;
}): Promise<Arquivo> {
  const { processo, arquivo, categoria, descricao, autor, compartilharCom } = opts;
  if (arquivo.size > LIMITE_MB * 1024 * 1024) throw new Error(`"${arquivo.name}" passa de ${LIMITE_MB} MB.`);
  const status = await googleDrive.status();
  if (!status.connected) throw new Error("Conecte sua conta Google (Perfil → Backup) para anexar documentos no Drive.");
  const [enviado, miniatura] = await Promise.all([
    googleDrive.docUpload({
      processoId: processo.id,
      pastaNome: nomePastaProcesso(processo),
      nome: arquivo.name,
      mime: arquivo.type || "application/octet-stream",
      dados: new Uint8Array(await arquivo.arrayBuffer()),
      compartilharCom,
    }),
    gerarMiniatura(arquivo),
  ]);
  const registro: Arquivo = {
    id: crypto.randomUUID(),
    nome: arquivo.name,
    categoria,
    descricao: descricao || undefined,
    tamanho: arquivo.size,
    tipo: arquivo.type || undefined,
    entidadeId: processo.id,
    entidadeTipo: "processo",
    dados: miniatura,
    responsavelId: autor.id,
    criadoEm: new Date().toISOString(),
    driveFileId: enviado.id,
    driveLink: enviado.link,
    driveDono: enviado.dono,
  };
  await db.arquivos.add(registro);
  await addHistorico(processo.id, "processo", "documento_anexado", `Documento "${arquivo.name}" anexado (${categoria})`, autor.id, autor.nome);
  return registro;
}

/**
 * Remove o documento do processo. Se o arquivo é desta conta Google, vai para a
 * lixeira do Drive (recuperável por 30 dias); se é de outra pessoa, só sai da lista.
 */
export async function removerDocumento(a: Arquivo, autor: { id: string; nome: string }) {
  if (a.driveFileId && driveDisponivel()) {
    const status = await googleDrive.status().catch(() => null);
    if (status?.connected && (!a.driveDono || a.driveDono === status.email)) {
      await googleDrive.docDelete(a.driveFileId).catch((e) => {
        if (!/404|not found|não encontrado/i.test(String(e?.message))) throw e;
      });
    }
  }
  await db.arquivos.delete(a.id);
  await addHistorico(a.entidadeId, "processo", "documento_removido", `Documento "${a.nome}" removido`, autor.id, autor.nome);
}
