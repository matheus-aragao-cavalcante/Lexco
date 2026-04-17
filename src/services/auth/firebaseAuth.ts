/**
 * Stub de autenticação Google via Firebase.
 *
 * Hoje retorna um aviso. Para ativar:
 * 1. Habilite Google Sign-In no Console Firebase.
 * 2. Descomente as linhas FIREBASE: aqui e em src/lib/firebase.ts.
 * 3. Conecte o resultado ao AuthContext (criar/buscar usuário local mirror).
 */
// FIREBASE: import { signInWithPopup, signOut } from "firebase/auth";
// FIREBASE: import { firebaseAuth, googleProvider } from "@/lib/firebase";

export async function signInWithGoogleStub(): Promise<{ success: boolean; message: string }> {
  // FIREBASE: const result = await signInWithPopup(firebaseAuth, googleProvider);
  // FIREBASE: const fbUser = result.user;
  // FIREBASE: // espelhe esse usuário no Dexie e marque a sessão local
  // FIREBASE: return { success: true, message: fbUser.email ?? "" };
  return {
    success: false,
    message:
      "Login com Google ainda não está conectado. Configure o Firebase em src/lib/firebase.ts (plano Spark) para ativar.",
  };
}

export async function signOutFirebaseStub() {
  // FIREBASE: await signOut(firebaseAuth);
}
