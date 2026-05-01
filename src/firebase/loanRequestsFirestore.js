import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { db } from './index';
import {
  LOAN_REQUEST_OPEN_STATUSES,
  LOAN_REQUEST_STATUSES,
  LOAN_REQUESTS_COLLECTION,
} from './loanRequests';
import { mapFirestoreError, normalizeFirestoreErrorCode } from './firestoreErrors';

/** Limite prático de documentos por lista na UI (paginação fora do escopo v1). */
const CLIENT_LIST_LIMIT = 100;

/**
 * Verifica se já existe pedido aberto para o vínculo (duplicidade v1).
 *
 * @param {string} linkId
 * @returns {Promise<{ exists: false } | { exists: true; id: string }>}
 */
export async function findOpenLoanRequestForLinkId(linkId) {
  if (!db || !linkId) {
    return { exists: false };
  }

  try {
    const q = query(
      collection(db, LOAN_REQUESTS_COLLECTION),
      where('linkId', '==', linkId),
      where('status', 'in', [...LOAN_REQUEST_OPEN_STATUSES]),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return { exists: false };
    }
    const d = snap.docs[0];
    return { exists: true, id: d.id };
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[loanRequests] findOpenLoanRequestForLinkId', e);
    }
    throw e;
  }
}

/**
 * Lista pedidos em que o usuário atua como cliente (mais recentes primeiro).
 *
 * @param {string} clientId
 */
export async function listLoanRequestsForClient(clientId) {
  if (!db || !clientId) {
    return [];
  }

  const q = query(
    collection(db, LOAN_REQUESTS_COLLECTION),
    where('clientId', '==', clientId),
    orderBy('createdAt', 'desc'),
    limit(CLIENT_LIST_LIMIT),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * @param {{
 *   supplierId: string;
 *   clientId: string;
 *   linkId: string;
 *   requestedAmountCents: number;
 *   clientNote: string;
 * }} params
 * @returns {Promise<{ ok: true; id: string } | { ok: false; message: string }>}
 */
export async function createLoanRequest({
  supplierId,
  clientId,
  linkId,
  requestedAmountCents,
  clientNote,
}) {
  if (!db) {
    return { ok: false, message: 'Firestore não está configurado neste ambiente.' };
  }

  try {
    const ref = await addDoc(collection(db, LOAN_REQUESTS_COLLECTION), {
      supplierId,
      clientId,
      linkId,
      requestedAmount: requestedAmountCents,
      clientNote,
      status: LOAN_REQUEST_STATUSES.PENDING,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true, id: ref.id };
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[loanRequests] createLoanRequest', e);
    }
    return { ok: false, message: mapCreateLoanRequestError(e) };
  }
}

/**
 * @param {{ requestId: string }} params
 * @returns {Promise<{ ok: true } | { ok: false; message: string }>}
 */
export async function cancelLoanRequestByClient({ requestId }) {
  if (!db) {
    return { ok: false, message: 'Firestore não está configurado neste ambiente.' };
  }
  if (!requestId) {
    return { ok: false, message: 'Pedido inválido.' };
  }

  try {
    const ref = doc(db, LOAN_REQUESTS_COLLECTION, requestId);
    await updateDoc(ref, {
      status: LOAN_REQUEST_STATUSES.CANCELLED_BY_CLIENT,
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[loanRequests] cancelLoanRequestByClient', e);
    }
    return { ok: false, message: mapCreateLoanRequestError(e) };
  }
}

/** @param {unknown} e */
function mapCreateLoanRequestError(e) {
  const code = normalizeFirestoreErrorCode(e);
  if (code === 'permission-denied') {
    return 'Permissão negada. Confira se o vínculo ainda está aprovado e se você está conectado como cliente.';
  }
  return mapFirestoreError(e);
}
