import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { mapFirestoreError } from './firestoreErrors';
import { db } from './index';

const USERS_COLLECTION = 'users';

/**
 * @param {string} uid
 */
export function getUserProfileRef(uid) {
  if (!db) {
    throw new Error('Firestore não está configurado neste ambiente.');
  }

  return doc(db, USERS_COLLECTION, uid);
}

/**
 * Shape mínimo do perfil remoto.
 * Mantém o foco em identidade básica, sem misturar com o domínio financeiro.
 *
 * @param {import('firebase/auth').User} user
 */
export function buildUserProfileData(user) {
  return {
    displayName: user.displayName?.trim() || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * @param {string} uid
 */
export async function getUserProfile(uid) {
  if (!db || !uid) {
    return null;
  }

  const snapshot = await getDoc(getUserProfileRef(uid));
  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data();
}

const DISPLAY_NAME_MAX_LEN = 80;

/**
 * Atualização parcial alinhada a `firestore.rules`: só `displayName` e `updatedAt` mudam;
 * `createdAt` permanece intacto no servidor.
 *
 * @param {string} uid
 * @param {string} rawDisplayName
 * @returns {Promise<{ ok: true } | { ok: false; message: string }>}
 */
export async function updateUserDisplayName(uid, rawDisplayName) {
  if (!db || !uid) {
    return { ok: false, message: 'Perfil remoto indisponível neste ambiente.' };
  }

  const displayName = String(rawDisplayName ?? '').trim();
  if (displayName.length > DISPLAY_NAME_MAX_LEN) {
    return { ok: false, message: `Nome muito longo (máx. ${DISPLAY_NAME_MAX_LEN} caracteres).` };
  }

  try {
    await updateDoc(getUserProfileRef(uid), {
      displayName,
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: mapFirestoreError(e) };
  }
}

/**
 * Cria o perfil remoto mínimo do usuário autenticado.
 *
 * @param {import('firebase/auth').User} user
 */
export async function createUserProfile(user) {
  if (!user?.uid) {
    throw new Error('createUserProfile requer um usuário autenticado com uid.');
  }

  const profileRef = getUserProfileRef(user.uid);
  await setDoc(profileRef, buildUserProfileData(user));
  return profileRef;
}

/**
 * Garante que exista um documento `users/{uid}` sem sobrescrever o perfil já existente.
 *
 * @param {import('firebase/auth').User} user
 */
export async function ensureUserProfileExists(user) {
  if (!user?.uid) {
    return { created: false, profile: null };
  }

  if (!db) {
    return { created: false, profile: null };
  }

  const profileRef = getUserProfileRef(user.uid);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(profileRef);

    if (snapshot.exists()) {
      return { created: false, profile: snapshot.data() };
    }

    transaction.set(profileRef, buildUserProfileData(user));
    return { created: true, profile: null };
  });
}
