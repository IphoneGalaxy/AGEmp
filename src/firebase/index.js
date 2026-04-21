/**
 * Inicialização única do Firebase para o app web.
 * Importe este módulo apenas quando for usar Auth ou Firestore (próximas fases).
 * Não altera o fluxo local-first atual enquanto não for importado.
 *
 * Singleton: reutiliza o app default se já existir (evita double-init com HMR/reexecução do módulo).
 */
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

import { getFirebaseWebConfig, isFirebaseConfigured } from './config';

export const firebaseEnabled = isFirebaseConfigured();

const firebaseApp = firebaseEnabled
  ? getApps().length === 0
    ? initializeApp(getFirebaseWebConfig())
    : getApp()
  : null;

export const app = firebaseApp;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
