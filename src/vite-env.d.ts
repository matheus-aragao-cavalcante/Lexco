/// <reference types="vite/client" />

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
    upload(name: string, content: string): Promise<LexcoIpcResult<LexcoDriveFile>>;
    list(): Promise<LexcoIpcResult<LexcoDriveFile[]>>;
    download(id: string): Promise<LexcoIpcResult<string>>;
    delete(id: string): Promise<LexcoIpcResult<void>>;
  };
}

interface Window {
  lexcoDesktop?: LexcoDesktopAPI;
}
