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

import { app, auth, db } from './index';
import {
  LOAN_REQUEST_MAX_AMOUNT_CENTS,
  LOAN_REQUEST_MAX_NOTE_CHARS,
  LOAN_REQUEST_MIN_AMOUNT_CENTS,
  LOAN_REQUEST_OPEN_STATUSES,
  LOAN_REQUEST_READ_BY_CLIENT_AT_FIELD,
  LOAN_REQUEST_READ_BY_SUPPLIER_AT_FIELD,
  LOAN_REQUEST_STATUSES,
  LOAN_REQUESTS_COLLECTION,
} from './loanRequests';
import { mapFirestoreError, normalizeFirestoreErrorCode } from './firestoreErrors';
import { normalizeNoteForLoanRequest } from '../utils/brlMoneyInput';
import { LINKS_COLLECTION, LINK_STATUSES, preflightUsersForLinkCreate } from './links';

/** Limite prático de documentos por lista na UI (paginação fora do escopo v1). */
const LOAN_REQUEST_LIST_LIMIT = 100;

/**
 * Verifica se já existe pedido aberto para o vínculo (duplicidade v1/v1.1).
 * Inclui `clientId` na query para compatibilidade com as Security Rules (`list`/query só
 * com escopo por participante autenticado).
 *
 * @param {string} linkId id do doc em `links/` (determinístico `supplierId__clientId`).
 * @param {string} clientId UID Firebase do cliente criador/consultante.
 * @returns {Promise<{ exists: false } | { exists: true; id: string }>}
 */
export async function findOpenLoanRequestForLinkId(linkId, clientId) {
  if (!db || !linkId || !clientId) {
    return { exists: false };
  }

  try {
    const q = query(
      collection(db, LOAN_REQUESTS_COLLECTION),
      where('clientId', '==', clientId),
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
 * Fatia CN v1.1 — fornecedor propõe contraposta (única rodada prevista pelo contrato atual).
 *
 * @param {{
 *   requestId: string;
 *   supplierUid: string;
 *   counterofferAmountCents: number;
 *   supplierNote?: string;
 * }} params
 */
export async function supplierProposeLoanRequestCounteroffer({
  requestId,
  supplierUid,
  counterofferAmountCents,
  supplierNote,
}) {
  if (!db) {
    return { ok: false, message: 'Firestore não está configurado neste ambiente.' };
  }
  if (!requestId || !supplierUid || typeof counterofferAmountCents !== 'number') {
    return { ok: false, message: 'Pedido ou valor da contraproposta inválido.' };
  }
  const cents = Math.round(Number(counterofferAmountCents));
  if (
    cents < LOAN_REQUEST_MIN_AMOUNT_CENTS ||
    cents > LOAN_REQUEST_MAX_AMOUNT_CENTS ||
    Number.isNaN(cents) ||
    !Number.isFinite(cents) ||
    !Number.isInteger(cents)
  ) {
    return { ok: false, message: 'Valor da contraproposta fora dos limites permitidos.' };
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
    if (
      status !== LOAN_REQUEST_STATUSES.PENDING &&
      status !== LOAN_REQUEST_STATUSES.UNDER_REVIEW
    ) {
      return {
        ok: false,
        message:
          'Só é possível enviar uma contraproposta quando o pedido está pendente ou em análise.',
      };
    }
    if (typeof data.counterofferAmount === 'number' || data.counterofferedAt != null) {
      return {
        ok: false,
        message: 'Este pedido já registrou uma contraproposta (apenas uma rodada é permitida).',
      };
    }
    if (typeof data.requestedAmount !== 'number') {
      return { ok: false, message: 'Valor original do pedido inválido.' };
    }
    if (cents === data.requestedAmount) {
      return {
        ok: false,
        message: 'Informe um valor diferente do valor solicitado (senão seria apenas aprovado).',
      };
    }

    const supplierNoteNormalized = normalizeNoteForLoanRequest(
      supplierNote ?? '',
      LOAN_REQUEST_MAX_NOTE_CHARS,
    );
    const notePatch = buildOptionalSupplierNoteUpdate(supplierNote);
    const committedAt = serverTimestamp();
    const payload = {
      status: LOAN_REQUEST_STATUSES.COUNTEROFFER,
      counterofferAmount: cents,
      counterofferedAt: committedAt,
      updatedAt: committedAt,
      ...notePatch,
    };

    if (import.meta.env.DEV) {
      console.info('[loanRequests][DEV] supplierProposeLoanRequestCounteroffer pre-updateDoc', {
        requestId,
        authUid: auth?.currentUser?.uid ?? null,
        supplierUid,
        docStatus: status,
        docSupplierId: data.supplierId,
        docClientId: data.clientId,
        docLinkId: data.linkId,
        requestedAmount: data.requestedAmount,
        counterofferAmount: cents,
        typeofCounterofferAmount: typeof cents,
        counterofferAmountIsInteger: Number.isInteger(cents),
        supplierNoteNormalized: supplierNoteNormalized || '(omit from payload)',
        payload,
        payloadKeys: Object.keys(payload),
      });
    }

    await updateDoc(ref, payload);
    return { ok: true };
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[loanRequests] supplierProposeLoanRequestCounteroffer', e);
    }
    return { ok: false, message: mapSupplierLoanRequestError(e) };
  }
}

/**
 * @param {{ requestId: string; clientUid: string }} params
 */
export async function clientAcceptLoanRequestCounteroffer({ requestId, clientUid }) {
  if (!db) {
    return { ok: false, message: 'Firestore não está configurado neste ambiente.' };
  }
  if (!requestId || !clientUid) {
    return { ok: false, message: 'Pedido inválido.' };
  }

  const ref = doc(db, LOAN_REQUESTS_COLLECTION, requestId);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { ok: false, message: 'Pedido não encontrado.' };
    }
    const data = snap.data();
    if (data.clientId !== clientUid) {
      return { ok: false, message: 'Este pedido não pertence ao seu papel de cliente aqui.' };
    }
    if (data.status !== LOAN_REQUEST_STATUSES.COUNTEROFFER) {
      return { ok: false, message: 'Neste momento não há contraproposta pendente neste pedido.' };
    }
    if (typeof data.counterofferAmount !== 'number') {
      return { ok: false, message: 'Valor da contraproposta indisponível.' };
    }
    const committedAt = serverTimestamp();
    await updateDoc(ref, {
      status: LOAN_REQUEST_STATUSES.APPROVED,
      approvedAmount: data.counterofferAmount,
      respondedAt: committedAt,
      updatedAt: committedAt,
    });
    return { ok: true };
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[loanRequests] clientAcceptLoanRequestCounteroffer', e);
    }
    return { ok: false, message: mapCreateLoanRequestError(e) };
  }
}

/**
 * @param {{ requestId: string; clientUid: string }} params
 */
export async function clientDeclineLoanRequestCounteroffer({ requestId, clientUid }) {
  if (!db) {
    return { ok: false, message: 'Firestore não está configurado neste ambiente.' };
  }
  if (!requestId || !clientUid) {
    return { ok: false, message: 'Pedido inválido.' };
  }

  const ref = doc(db, LOAN_REQUESTS_COLLECTION, requestId);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { ok: false, message: 'Pedido não encontrado.' };
    }
    const data = snap.data();
    if (data.clientId !== clientUid) {
      return { ok: false, message: 'Este pedido não pertence ao seu papel de cliente aqui.' };
    }
    if (data.status !== LOAN_REQUEST_STATUSES.COUNTEROFFER) {
      return { ok: false, message: 'Neste momento não há contraproposta pendente neste pedido.' };
    }
    const committedAt = serverTimestamp();
    await updateDoc(ref, {
      status: LOAN_REQUEST_STATUSES.COUNTEROFFER_DECLINED,
      respondedAt: committedAt,
      updatedAt: committedAt,
    });
    return { ok: true };
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[loanRequests] clientDeclineLoanRequestCounteroffer', e);
    }
    return { ok: false, message: mapCreateLoanRequestError(e) };
  }
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

/**
 * Par pré-financeiro “commitado”: centavos válidos + timestamp da contraproposta.
 * Só esse estado bloqueia nova rodada (chave `counterofferAmount` sem número não conta).
 *
 * @param {Record<string, unknown>} data
 */
function hasCommittedLoanRequestCounterofferPayload(data) {
  const amt = data.counterofferAmount;
  const hasValidAmt =
    typeof amt === 'number' &&
    Number.isFinite(amt) &&
    Number.isInteger(amt) &&
    amt >= LOAN_REQUEST_MIN_AMOUNT_CENTS &&
    amt <= LOAN_REQUEST_MAX_AMOUNT_CENTS;
  return hasValidAmt && data.counterofferedAt != null;
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

  const cents = Math.round(Number(requestedAmountCents));
  if (
    !Number.isFinite(cents) ||
    cents < LOAN_REQUEST_MIN_AMOUNT_CENTS ||
    cents > LOAN_REQUEST_MAX_AMOUNT_CENTS
  ) {
    return { ok: false, message: 'Valor do pedido inválido.' };
  }

  try {
    const profileGate = await preflightUsersForLinkCreate(clientId, supplierId);
    if (!profileGate.ok) {
      return profileGate;
    }

    const linkSnap = await getDoc(doc(db, LINKS_COLLECTION, linkId));
    if (!linkSnap.exists()) {
      return {
        ok: false,
        message:
          'Não encontramos o vínculo na nuvem com este ID. Recarregue a página ou confira se o projeto Firebase do app (.env.local) é o mesmo do console.',
      };
    }
    const ld = linkSnap.data();
    const ls = typeof ld?.status === 'string' ? ld.status : '';
    if (ls !== LINK_STATUSES.APPROVED) {
      return {
        ok: false,
        message:
          'O vínculo precisa estar aprovado para enviar um pedido. Atualize em Conta e tente novamente.',
      };
    }
    if (ld?.supplierId !== supplierId || ld?.clientId !== clientId) {
      return {
        ok: false,
        message:
          'Os dados do vínculo (fornecedor/cliente) não batem com a lista atual. Recarregue os vínculos em Conta.',
      };
    }

    const committedAt = serverTimestamp();
    /** @type {Record<string, unknown>} */
    const addPayload = {
      supplierId,
      clientId,
      linkId,
      requestedAmount: cents,
      clientNote: typeof clientNote === 'string' ? clientNote : '',
      status: LOAN_REQUEST_STATUSES.PENDING,
      createdAt: committedAt,
      updatedAt: committedAt,
    };

    if (import.meta.env.DEV) {
      const projectId =
        app && typeof app.options?.projectId === 'string'
          ? app.options.projectId
          : '(sem projectId no app)';
      console.info('[loanRequests] createLoanRequest addDoc (payload preview DEV)', {
        supplierId,
        clientId,
        linkId,
        requestedAmount: addPayload.requestedAmount,
        typeofRequestedAmount: typeof addPayload.requestedAmount,
        isIntegerRequestedAmount: Number.isInteger(/** @type {number} */ (addPayload.requestedAmount)),
        clientNote: addPayload.clientNote,
        typeofClientNote: typeof addPayload.clientNote,
        status: addPayload.status,
        authUid: auth?.currentUser?.uid ?? null,
        projectId,
      });
    }

    const ref = await addDoc(collection(db, LOAN_REQUESTS_COLLECTION), addPayload);
    return { ok: true, id: ref.id };
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[loanRequests] createLoanRequest', e);
    }
    return { ok: false, message: mapCreateLoanRequestError(e) };
  }
}

/**
 * Fatia RB v1.1: marca leitura do cliente. Não atualiza `updatedAt` (política B).
 *
 * @param {{ requestId: string; clientUid: string }} params
 * @returns {Promise<{ ok: true } | { ok: false; message: string }>}
 */
export async function markLoanRequestReadByClient({ requestId, clientUid }) {
  if (!db) {
    return { ok: false, message: 'Firestore não está configurado neste ambiente.' };
  }
  if (!requestId || !clientUid) {
    return { ok: false, message: 'Pedido inválido.' };
  }

  const ref = doc(db, LOAN_REQUESTS_COLLECTION, requestId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { ok: false, message: 'Pedido não encontrado.' };
    }
    const data = snap.data();
    if (data.clientId !== clientUid) {
      return { ok: false, message: 'Este pedido não pertence ao seu papel de cliente aqui.' };
    }
    await updateDoc(ref, {
      [LOAN_REQUEST_READ_BY_CLIENT_AT_FIELD]: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[loanRequests] markLoanRequestReadByClient', e);
    }
    return { ok: false, message: mapLoanRequestWriteError(e) };
  }
}

/**
 * Fatia RB v1.1: marca leitura do fornecedor. Não atualiza `updatedAt` (política B).
 *
 * @param {{ requestId: string; supplierUid: string }} params
 * @returns {Promise<{ ok: true } | { ok: false; message: string }>}
 */
export async function markLoanRequestReadBySupplier({ requestId, supplierUid }) {
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
      return { ok: false, message: 'Este pedido não pertence ao seu papel de fornecedor aqui.' };
    }
    await updateDoc(ref, {
      [LOAN_REQUEST_READ_BY_SUPPLIER_AT_FIELD]: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[loanRequests] markLoanRequestReadBySupplier', e);
    }
    return { ok: false, message: mapLoanRequestWriteError(e) };
  }
}

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
function mapLoanRequestWriteError(e) {
  const code = normalizeFirestoreErrorCode(e);
  if (code === 'permission-denied') {
    return 'Permissão negada. Confira papel, vínculo e se o pedido ainda permite esta ação.';
  }
  return mapFirestoreError(e);
}

/** @param {unknown} e */
function mapCreateLoanRequestError(e) {
  const normalized = normalizeFirestoreErrorCode(e);
  const rawCode =
    e && typeof e === 'object' && 'code' in e && typeof e.code === 'string' ? e.code : '';
  const isPermissionDenied =
    normalized === 'permission-denied' ||
    rawCode === 'permission-denied' ||
    rawCode.endsWith('/permission-denied');
  if (isPermissionDenied) {
    const pidRaw =
      typeof import.meta.env.VITE_FIREBASE_PROJECT_ID === 'string'
        ? import.meta.env.VITE_FIREBASE_PROJECT_ID.trim()
        : '';
    const pidHint =
      pidRaw !== '' ? ` Projeto configurado neste build: "${pidRaw}" (via VITE_FIREBASE_PROJECT_ID).` : '';
    return (
      'Permissão negada pelo servidor. Confira: projeto Firebase correto; vínculo aprovado ' +
      'em links/{UID do fornecedor}__{seu UID}; sua conta como cliente com papel Cliente; ' +
      'perfil remoto do fornecedor com papel Fornecedor (conta).' +
      pidHint
    );
  }
  return mapFirestoreError(e);
}
