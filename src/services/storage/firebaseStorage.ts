/**
 * Stub de upload — Firebase Storage.
 *
 * Hoje, anexos do processo são salvos como Base64 no IndexedDB (Dexie).
 * Para uploads reais (PDFs, petições grandes), troque por Firebase Storage:
 *
 * 1. Habilite Storage no Console Firebase.
 * 2. Descomente as linhas FIREBASE: aqui e em src/lib/firebase.ts.
 * 3. Em src/components/ProcessoDetalhe (aba Arquivos), substitua a leitura
 *    Base64 por uploadBytes() e salve apenas a URL no Firestore.
 */
// FIREBASE: import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
// FIREBASE: import { firebaseStorage } from "@/lib/firebase";

export async function uploadArquivoStub(
  _file: File,
  _path: string,
): Promise<{ url: string; path: string }> {
  // FIREBASE: const r = ref(firebaseStorage, _path);
  // FIREBASE: await uploadBytes(r, _file);
  // FIREBASE: const url = await getDownloadURL(r);
  // FIREBASE: return { url, path: _path };
  throw new Error("Upload via Firebase Storage ainda não habilitado.");
}
