import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FileText, Image as ImageIcon, Upload, ExternalLink, Trash2, Loader2, Camera, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIAS_ARQUIVO, type Arquivo, type Processo } from "@/types";
import { anexarDocumento, removerDocumento, driveDisponivel, LIMITE_MB } from "@/lib/documentosDrive";
import { formatBytes } from "@/lib/googleDrive";
import { cn } from "@/lib/utils";

/** Aba "Arquivos" do processo: fotos e documentos guardados no Google Drive. */
export function DocumentosProcesso({ processo, arquivos, autor, podeAnexar, compartilharCom, onMudou }: {
  processo: Processo;
  arquivos: Arquivo[];
  autor: { id: string; nome: string };
  podeAnexar: boolean;
  compartilharCom?: string;
  onMudou: () => void;
}) {
  const [categoria, setCategoria] = useState("Outro");
  const [enviando, setEnviando] = useState<string | null>(null);
  const [remover, setRemover] = useState<Arquivo | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const inputArquivos = useRef<HTMLInputElement>(null);
  const inputFoto = useRef<HTMLInputElement>(null);
  const desktop = driveDisponivel();

  const enviar = async (lista: FileList | File[] | null) => {
    const files = Array.from(lista || []);
    if (!files.length) return;
    let ok = 0;
    for (const f of files) {
      setEnviando(f.name);
      try {
        await anexarDocumento({
          processo, arquivo: f, autor, compartilharCom,
          categoria: f.type.startsWith("image/") && categoria === "Outro" ? "Foto" : categoria,
        });
        ok++;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Falha ao enviar "${f.name}"`);
      }
    }
    setEnviando(null);
    if (ok) toast.success(`${ok} arquivo(s) salvo(s) no Google Drive`);
    onMudou();
  };

  const abrir = (a: Arquivo) => {
    // Só abre links do Google Drive (um registro vindo de outro computador não pode apontar para outro site).
    if (a.driveLink && /^https:\/\/(drive|docs)\.google\.com\//.test(a.driveLink)) window.open(a.driveLink, "_blank");
    else if (a.dados?.startsWith("data:image/")) window.open(a.dados, "_blank");
    else toast.info("Este registro antigo não tem o arquivo disponível.");
  };

  const confirmarRemocao = async () => {
    if (!remover) return;
    try {
      await removerDocumento(remover, autor);
      toast.success("Documento removido (no Drive ele fica na lixeira por 30 dias)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover");
    }
    setRemover(null);
    onMudou();
  };

  const fotos = arquivos.filter((a) => a.tipo?.startsWith("image/"));
  const docs = arquivos.filter((a) => !a.tipo?.startsWith("image/"));

  return (
    <div className="space-y-4">
      {podeAnexar && (
        <div
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastando(false); if (desktop) enviar(e.dataTransfer.files); }}
          className={cn("bg-card rounded-lg border-2 border-dashed p-5 text-center space-y-3 transition-colors", arrastando ? "border-primary bg-primary/5" : "border-border")}
        >
          {desktop ? (
            <>
              <p className="text-sm text-foreground">Arraste arquivos aqui ou escolha abaixo</p>
              <p className="text-xs text-muted-foreground">
                Vão para a pasta deste processo no seu Google Drive ("Documentos/{processo.numero || processo.titulo}"). Até {LIMITE_MB} MB por arquivo.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-input bg-background text-sm" aria-label="Categoria">
                  {["Foto", ...CATEGORIAS_ARQUIVO].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <Button size="sm" onClick={() => inputArquivos.current?.click()} disabled={!!enviando}>
                  <Upload className="h-4 w-4 mr-1" /> Anexar documentos
                </Button>
                <Button size="sm" variant="outline" onClick={() => inputFoto.current?.click()} disabled={!!enviando}>
                  <Camera className="h-4 w-4 mr-1" /> Anexar fotos
                </Button>
              </div>
              {enviando && <p className="text-xs text-primary flex items-center justify-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando "{enviando}"...</p>}
              <input ref={inputArquivos} type="file" multiple className="hidden" onChange={(e) => { enviar(e.target.files); e.target.value = ""; }} />
              <input ref={inputFoto} type="file" multiple accept="image/*" className="hidden" onChange={(e) => { enviar(e.target.files); e.target.value = ""; }} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Anexar documentos no Google Drive está disponível no app de computador.</p>
          )}
        </div>
      )}

      {arquivos.length === 0 && (
        <div className="bg-card rounded-lg border shadow-card py-10 text-center text-muted-foreground text-sm">
          <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" /> Nenhum arquivo anexado
        </div>
      )}

      {fotos.length > 0 && (
        <div className="bg-card rounded-lg border shadow-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5"><ImageIcon className="h-4 w-4 text-primary" /> Fotos ({fotos.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {fotos.map((a) => (
              <div key={a.id} className="group relative rounded-lg border border-border overflow-hidden bg-muted/30">
                <button onClick={() => abrir(a)} className="block w-full aspect-square" title={`Abrir ${a.nome}`}>
                  {a.dados?.startsWith("data:image/") ? <img src={a.dados} alt={a.nome} className="w-full h-full object-cover" /> : <ImageIcon className="h-8 w-8 m-auto text-muted-foreground" />}
                </button>
                <div className="p-1.5 text-[11px] truncate text-foreground" title={a.nome}>{a.nome}</div>
                {podeAnexar && (
                  <button onClick={() => setRemover(a)} aria-label="Remover foto"
                    className="absolute top-1 right-1 h-7 w-7 rounded-full bg-background/90 text-destructive opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {docs.length > 0 && (
        <div className="bg-card rounded-lg border shadow-card divide-y divide-border">
          {docs.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-3">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <button onClick={() => abrir(a)} className="text-sm font-medium text-foreground hover:text-primary text-left truncate block max-w-full">{a.nome}</button>
                <p className="text-xs text-muted-foreground">
                  {a.categoria}{a.tamanho ? ` · ${formatBytes(a.tamanho)}` : ""} · {new Date(a.criadoEm).toLocaleDateString("pt-BR")}
                  {a.driveFileId ? " · Google Drive" : " · arquivo local antigo"}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => abrir(a)} aria-label="Abrir"><ExternalLink className="h-4 w-4" /></Button>
              {podeAnexar && <Button size="icon" variant="ghost" onClick={() => setRemover(a)} aria-label="Remover"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!remover}
        onOpenChange={(v) => !v && setRemover(null)}
        title="Remover documento?"
        description={remover ? `"${remover.nome}" sai deste processo. No Google Drive ele vai para a lixeira (recuperável por 30 dias).` : ""}
        confirmLabel="Remover"
        onConfirm={confirmarRemocao}
      />
    </div>
  );
}
