import {
  addDoc,
  collection,
  doc,
  getDoc,
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
  LOAN_REQUEST_MAX_NOTE_CHARS,
  LOAN_REQUEST_OPEN_STATUSES,
  LOAN_REQUEST_STATUSES,
  LOAN_REQUESTS_COLLECTION,
} from './loanRequests';
import { mapFirestoreError, normalizeFirestoreErrorCode } from './firestoreErrors';
import { normalizeNoteForLoanRequest } from '../utils/brlMoneyInput';

/** Limite prático de documentos por lista na UI (paginação fora do escopo v1). */
const LOAN_REQUEST_LIST_LIMIT = 100;

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
    limit(LOAN_REQUEST_LIST_LIMIT),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Lista pedidos em que o usuário atua como fornecedor (mais recentes primeiro).
 *
 * @param {string} supplierId
 */
export async function listLoanRequestsForSupplier(supplierId) {
  if (!db || !supplierId) {
    return [];
  }

  const q = query(
    collection(db, LOAN_REQUESTS_COLLECTION),
    where('supplierId', '==', supplierId),
    orderBy('createdAt', 'desc'),
    limit(LOAN_REQUEST_LIST_LIMIT),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * @param {{ requestId: string; supplierUid: string; supplierNote?: string }} params
 * @returns {Promise<{ ok: true } | { ok: false; message: string }>}
 */
export async function supplierMarkLoanRequestUnderReview({ requestId, supplierUid, supplierNote }) {
  return supplierTransitionFromDoc(requestId, supplierUid, 'under_review', supplierNote);
}

/**
 * @param {{ requestId: string; supplierUid: string; supplierNote?: string }} params
 */
export async function supplierApproveLoanRequest({ requestId, supplierUid, supplierNote }) {
  return supplierTransitionFromDoc(requestId, supplierUid, 'approved', supplierNote);
}

/**
 * @param {{ requestId: string; supplierUid: string; supplierNote?: string }} params
 */
export async function supplierRejectLoanRequest({ requestId, supplierUid, supplierNote }) {
  return supplierTransitionFromDoc(requestId, supplierUid, 'rejected', supplierNote);
}

/**
 * @param {string} requestId
 * @param {string} supplierUid
 * @param {'under_review' | 'approved' | 'rejected'} action
 * @param {string} [supplierNoteRaw]
 */
async function supplierTransitionFromDoc(requestId, supplierUid, action, supplierNoteRaw) {
  if (!db) {
    return { ok: false, message: 'Firestore não está configurado neste ambiente.' };
  }
  if (!requestId || !supplierUid) {
    return { ok: false, message: 'Pedido inválido.' };
  }

  const ref = doc(db, LOAN_REQUESTS_COLLECTION, requestId);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { ok: false, message: 'Pedido não encontrado.' };
    }
    const data = snap.data();
    if (data.supplierId !== supplierUid) {
      return { ok: false, message: 'Este pedido não pertence à sua conta como fornecedor.' };
    }

    const status = typeof data.status === 'string' ? data.status : '';
    const noteFields = buildOptionalSupplierNoteUpdate(supplierNoteRaw);

    if (action === 'under_review') {
      if (status !== LOAN_REQUEST_STATUSES.PENDING) {
        return { ok: false, message: 'Só é possível marcar em análise a partir de pendente.' };
      }
      await updateDoc(ref, {
        status: LOAN_REQUEST_STATUSES.UNDER_REVIEW,
        updatedAt: serverTimestamp(),
        ...noteFields,
      });
      return { ok: true };
    }

    if (action === 'approved') {
      if (
        status !== LOAN_REQUEST_STATUSES.PENDING &&
        status !== LOAN_REQUEST_STATUSES.UNDER_REVIEW
      ) {
        return { ok: false, message: 'Este pedido já foi respondido ou não pode ser aprovado.' };
      }
      if (typeof data.requestedAmount !== 'number') {
        return { ok: false, message: 'Valor do pedido inválido.' };
      }
      await updateDoc(ref, {
        status: LOAN_REQUEST_STATUSES.APPROVED,
        updatedAt: serverTimestamp(),
        respondedAt: serverTimestamp(),
        approvedAmount: data.requestedAmount,
        ...noteFields,
      });
      return { ok: true };
    }

    if (action === 'rejected') {
      if (
        status !== LOAN_REQUEST_STATUSES.PENDING &&
        status !== LOAN_REQUEST_STATUSES.UNDER_REVIEW
      ) {
        return { ok: false, message: 'Este pedido já foi respondido ou não pode ser recusado.' };
      }
      await updateDoc(ref, {
        status: LOAN_REQUEST_STATUSES.REJECTED,
        updatedAt: serverTimestamp(),
        respondedAt: serverTimestamp(),
        ...noteFields,
      });
      return { ok: true };
    }

    return { ok: false, message: 'Ação inválida.' };
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[loanRequests] supplierTransitionFromDoc', e);
    }
    return { ok: false, message: mapSupplierLoanRequestError(e) };
  }
}

/**
 * @param {string | undefined} raw
 * @returns {Record<string, string>}
 */
function buildOptionalSupplierNoteUpdate(raw) {
  const n = normalizeNoteForLoanRequest(raw ?? '', LOAN_REQUEST_MAX_NOTE_CHARS);
  if (!n) {
    return {};
  }
  return { supplierNote: n };
}

/** @param {unknown} e */
function mapSupplierLoanRequestError(e) {
  const code = normalizeFirestoreErrorCode(e);
  if (code === 'permission-denied') {
    return 'Permissão negada. O vínculo pode ter sido revogado, o pedido pode ter sido cancelado pelo cliente ou já respondido em outra sessão.';
  }
  return mapFirestoreError(e);
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
