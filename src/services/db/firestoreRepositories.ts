/**
 * Repositórios — preparação para Firestore.
 *
 * Hoje, toda a persistência da app usa Dexie (IndexedDB) via src/lib/db.ts.
 * Quando você quiser migrar para Firestore (gratuito no Spark), implemente
 * aqui os métodos equivalentes e troque os imports nas páginas/dialogs.
 *
 * Sugestão de coleções Firestore:
 *   users/{uid}
 *   processos/{processId}
 *   processos/{processId}/prazos/{prazoId}
 *   processos/{processId}/documentos/{docId}
 *   partes/{parteId}
 *   eventos/{eventoId}
 *
 * Lembre-se das Security Rules:
 *   - usuário só lê/escreve documentos do mesmo orgId
 *   - admin tem acesso ampliado
 */
// FIREBASE: import { firestore } from "@/lib/firebase";
// FIREBASE: import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where } from "firebase/firestore";

// Esqueleto genérico — ative quando migrar.
export const firestoreRepo = {
  // async getProcesso(id: string) { return getDoc(doc(firestore, "processos", id)); },
  // async listProcessos(orgId: string) { ... },
  // async saveProcesso(p: Processo) { ... },
  // async deleteProcesso(id: string) { ... },
};
