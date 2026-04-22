import { updateProfile } from 'firebase/auth';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { mapFirebaseAuthError } from '../auth/authErrors';
import { mapFirestoreError } from './firestoreErrors';
import { auth, db } from './index';
import {
  USER_ROLE_VALUES,
  getEffectiveAccountRoles,
  isValidUserRole,
  sortAccountRoles,
} from './roles';

const USERS_COLLECTION = 'users';
const DISPLAY_NAME_MAX_LEN = 80;
const REMOTE_PROFILE_UNAVAILABLE_MESSAGE = 'Perfil remoto indisponível neste ambiente.';

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
    return { ok: false, message: REMOTE_PROFILE_UNAVAILABLE_MESSAGE };
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
 * Define o papel remoto do usuário.
 * As rules impedem trocas arbitrárias depois da primeira escolha.
 *
 * @param {string} uid
 * @param {'supplier' | 'client'} role
 * @returns {Promise<{ ok: true } | { ok: false; message: string }>}
 */
export async function setUserRole(uid, role) {
  if (!db || !uid) {
    return { ok: false, message: REMOTE_PROFILE_UNAVAILABLE_MESSAGE };
  }

  if (!isValidUserRole(role)) {
    return {
      ok: false,
      message: `Papel inválido. Use ${USER_ROLE_VALUES.join(' ou ')}.`,
    };
  }

  try {
    await updateDoc(getUserProfileRef(uid), {
      role,
      roleSetAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      accountRoles: [role],
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: mapFirestoreError(e) };
  }
}

/**
 * Adiciona um papel à conta de forma aditiva (`accountRoles`), sem remover papéis existentes
 * nem alterar o `role` legado. Idempotente se o papel já estiver nos papéis efetivos.
 *
 * @param {string} uid
 * @param {'supplier' | 'client'} roleToAdd
 * @returns {Promise<{ ok: true } | { ok: false; message: string }>}
 */
export async function addAccountRole(uid, roleToAdd) {
  if (!db || !uid) {
    return { ok: false, message: REMOTE_PROFILE_UNAVAILABLE_MESSAGE };
  }

  if (!isValidUserRole(roleToAdd)) {
    return {
      ok: false,
      message: `Papel inválido. Use ${USER_ROLE_VALUES.join(' ou ')}.`,
    };
  }

  const profileRef = getUserProfileRef(uid);

  try {
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(profileRef);
      if (!snapshot.exists()) {
        return { ok: false, message: 'Perfil remoto não encontrado.' };
      }

      const data = snapshot.data();
      if (!isValidUserRole(data.role)) {
        return {
          ok: false,
          message: 'Defina primeiro seu papel na plataforma (uma única vez) antes de habilitar outro papel.',
        };
      }

      const effective = getEffectiveAccountRoles(data);
      if (effective.includes(roleToAdd)) {
        return { ok: true };
      }

      const next = sortAccountRoles([...effective, roleToAdd]);
      if (next.length > 2) {
        return { ok: false, message: 'Esta conta já possui os dois papéis habilitados.' };
      }

      transaction.update(profileRef, {
        accountRoles: next,
        updatedAt: serverTimestamp(),
      });

      return { ok: true };
    });
  } catch (e) {
    return { ok: false, message: mapFirestoreError(e) };
  }
}

/**
 * Atualiza `displayName` no Firestore (fonte primária) e espelha em Firebase Auth.
 * Se o Firestore falhar, Auth não é alterado.
 * Se o Firestore ok e Auth falhar, o documento em `users/{uid}` permanece; retorna sucesso com aviso.
 *
 * @param {import('firebase/auth').User} user
 * @param {string} rawDisplayName
 * @returns {Promise<
 *   | { ok: true }
 *   | { ok: true; authSyncFailed: true; message: string }
 *   | { ok: false; message: string; stage?: 'firestore' }
 * >}
 */
export async function updateUserDisplayNameWithAuthMirror(user, rawDisplayName) {
  if (!user?.uid) {
    return { ok: false, message: 'Sessão inválida. Entre novamente.', stage: 'firestore' };
  }

  const firestoreResult = await updateUserDisplayName(user.uid, rawDisplayName);
  if (!firestoreResult.ok) {
    return { ...firestoreResult, stage: 'firestore' };
  }

  if (!auth || !auth.currentUser || auth.currentUser.uid !== user.uid) {
    return { ok: true, authSyncFailed: true, message: 'Sessão desatualizada. O nome foi salvo na nuvem, mas o perfil local não pôde ser atualizado. Saia e entre de novo se necessário.' };
  }

  const displayName = String(rawDisplayName ?? '').trim();

  try {
    await updateProfile(auth.currentUser, { displayName: displayName || null });
    return { ok: true };
  } catch (e) {
    return {
      ok: true,
      authSyncFailed: true,
      message: mapFirebaseAuthError(e),
    };
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
