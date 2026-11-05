/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "spu" gera a versão SPU/Pública; ausente = versão completa. */
  readonly VITE_EDICAO?: "completa" | "spu";
}

/** Resultado padrão das chamadas ao processo principal (electron/google.cjs). */
type LexcoIpcResult<T> = { ok: true; value: T } | { ok: false; error: string };

interface LexcoGoogleStatus {
  configured: boolean;
  connected: boolean;
  email: string;
}

interface LexcoGoogleProfile {
  email: string;
  name: string;
  /** data URL da foto (vazio se indisponível). */
  picture: string;
}

interface LexcoDriveFile {
  id: string;
  name: string;
  size: number;
  createdTime: string;
}

/** API exposta pelo Electron (electron/preload.cjs). Ausente quando roda no navegador. */
interface LexcoDesktopAPI {
  isDesktop: true;
  platform: string;
  google: {
    status(): Promise<LexcoIpcResult<LexcoGoogleStatus>>;
    connect(): Promise<LexcoIpcResult<LexcoGoogleStatus & { profile: LexcoGoogleProfile }>>;
    cancelConnect(): Promise<LexcoIpcResult<void>>;
    disconnect(): Promise<LexcoIpcResult<LexcoGoogleStatus>>;
    signOut(): Promise<LexcoIpcResult<LexcoGoogleStatus>>;
    upload(name: string, content: string, auto?: boolean, contaEsperada?: string): Promise<LexcoIpcResult<LexcoDriveFile>>;
    list(): Promise<LexcoIpcResult<LexcoDriveFile[]>>;
    download(id: string): Promise<LexcoIpcResult<string>>;
    delete(id: string): Promise<LexcoIpcResult<void>>;
    docUpload(args: {
      processoId: string; pastaNome: string; nome: string; mime: string; dados: Uint8Array; compartilharCom?: string;
    }): Promise<LexcoIpcResult<{ id: string; link: string; dono: string }>>;
    docDelete(id: string): Promise<LexcoIpcResult<void>>;
    docsCompartilhar(email: string, permitir: boolean): Promise<LexcoIpcResult<boolean>>;
    sharePublish(id: string | null, name: string, content: string): Promise<LexcoIpcResult<string>>;
    shareDelete(id: string): Promise<LexcoIpcResult<void>>;
    /** Erro "REMOVIDO" quando o arquivo não existe mais (acesso revogado). */
    shareRead(id: string): Promise<LexcoIpcResult<string>>;
  };
  consulta: {
    datajud(alias: string, numero: string): Promise<LexcoIpcResult<unknown>>;
    djen(numero: string): Promise<LexcoIpcResult<unknown>>;
  };
}

interface Window {
  lexcoDesktop?: LexcoDesktopAPI;
}
