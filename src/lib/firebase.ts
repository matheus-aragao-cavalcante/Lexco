/**
 * ============================================================
 * Firebase Bridge — Lexco (preparação para Firebase Spark)
 * ============================================================
 *
 * Esta é a CAMADA DE INTEGRAÇÃO preparada para uma futura conexão real com
 * Firebase. Atualmente NADA aqui faz chamadas reais — todas as funções são
 * STUBS comentadas didaticamente para o usuário (você) plugar quando quiser.
 *
 * Quando ativar o Firebase no plano Spark, basta:
 *
 * 1. Instalar a SDK:
 *      npm install firebase
 *
 * 2. Preencher firebaseConfig abaixo com as credenciais do seu projeto
 *    (Console Firebase > Configurações do Projeto > seus apps).
 *
 * 3. Descomentar as linhas marcadas com `// FIREBASE:` em cada arquivo:
 *      - src/lib/firebase.ts            (init do app + auth + db + storage)
 *      - src/services/auth/firebaseAuth.ts
 *      - src/services/db/firestoreRepositories.ts
 *      - src/services/storage/firebaseStorage.ts
 *
 * 4. Configurar no Console Firebase:
 *      - Authentication > Sign-in method > Google (habilitar)
 *      - Firestore Database > Criar banco em modo produção
 *      - Storage (opcional, para uploads reais)
 *      - Hosting (opcional, para deploy)
 *
 * 5. Substituir gradualmente os repositórios locais (Dexie) pelos do
 *    Firestore — a arquitetura `services/db/*` foi pensada para isso.
 *
 * Hospedagem no plano Spark (gratuito):
 *      firebase init hosting && firebase deploy
 *
 * ============================================================
 */

// FIREBASE: import { initializeApp, type FirebaseApp } from "firebase/app";
// FIREBASE: import { getAuth, type Auth, GoogleAuthProvider } from "firebase/auth";
// FIREBASE: import { getFirestore, type Firestore } from "firebase/firestore";
// FIREBASE: import { getStorage, type FirebaseStorage } from "firebase/storage";

/**
 * Cole aqui as credenciais do seu projeto Firebase.
 * Encontre em: console.firebase.google.com > Configurações > seus apps web.
 *
 * Estas chaves são PUBLISHABLE (seguras para o frontend). A segurança real
 * vem das Security Rules do Firestore/Storage, não delas.
 */
export const firebaseConfig = {
  apiKey: "TODO_API_KEY",
  authDomain: "TODO.firebaseapp.com",
  projectId: "TODO_PROJECT_ID",
  storageBucket: "TODO.appspot.com",
  messagingSenderId: "TODO_SENDER_ID",
  appId: "TODO_APP_ID",
};

// FIREBASE: export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);
// FIREBASE: export const firebaseAuth: Auth = getAuth(firebaseApp);
// FIREBASE: export const firestore: Firestore = getFirestore(firebaseApp);
// FIREBASE: export const firebaseStorage: FirebaseStorage = getStorage(firebaseApp);
// FIREBASE: export const googleProvider = new GoogleAuthProvider();

/** Flag global: enquanto false, o app inteiro continua rodando 100% local (Dexie/IndexedDB). */
export const FIREBASE_ENABLED = false;
