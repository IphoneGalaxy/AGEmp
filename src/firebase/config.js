/**
 * Configuração do Firebase a partir das variáveis de ambiente do Vite (`import.meta.env`).
 * Não incluir valores fixos aqui — use `.env.local` (ver `.env.example`).
 */

const REQUIRED_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

/**
 * @returns {string[]}
 */
export function getMissingFirebaseEnvKeys() {
  const env = import.meta.env;
  return REQUIRED_ENV_KEYS.filter(
    (key) => !env[key] || String(env[key]).trim() === ''
  );
}

/**
 * Permite manter o app local-first funcionando mesmo em ambientes sem Firebase configurado.
 */
export function isFirebaseConfigured() {
  return getMissingFirebaseEnvKeys().length === 0;
}

/**
 * @returns {import('firebase/app').FirebaseOptions}
 */
export function getFirebaseWebConfig() {
  const env = import.meta.env;
  const missing = getMissingFirebaseEnvKeys();
  if (missing.length > 0) {
    throw new Error(
      `Firebase: variáveis ausentes ou vazias: ${missing.join(', ')}. ` +
        'Copie .env.example para .env.local e preencha os valores.'
    );
  }

  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
}
