import {
  LOAN_REQUEST_STATUSES,
  isLoanRequestTerminalStatusV1,
} from '../firebase/loanRequests';

/**
 * Sem readBySupplierAt, vários pendings legados recebiam "Novo" igual ao primeiro.
 * Mantém "Novo" só em pendências com criação recente (mesmo valor que LoanRequestsSupplierPanel).
 */
export const SUPPLIER_UNREAD_PENDING_MAX_AGE_SEC = 14 * 24 * 60 * 60;

/** @param {(number | null)[]} candidates */
function maxSecondsOrNull(candidates) {
  const nums = candidates.filter((x) => typeof x === 'number' && Number.isFinite(x));
  return nums.length ? Math.max(...nums) : null;
}

/**
 * Extrai instante em segundos Unix a partir de Timestamp Firestore, número (segundos) ou objeto com toMillis.
 * @param {unknown} ts
 * @returns {number | null}
 */
export function firestoreTimestampSecondsOrNull(ts) {
  if (ts == null) return null;
  if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
  if (typeof ts !== 'object') return null;
  if (typeof ts.seconds === 'number') return ts.seconds;
  if (typeof ts._seconds === 'number') return ts._seconds;
  if (typeof ts.toMillis === 'function') {
    try {
      const ms = ts.toMillis();
      if (Number.isFinite(ms)) return Math.floor(ms / 1000);
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Último instante documentado de ação relevante do fornecedor (badge "Novo" do cliente).
 * Espelho de getSupplierEventSecondsForClientBadge em LoanRequestsClientPanel.jsx
 * @param {Record<string, unknown>} r
 * @returns {number | null}
 */
export function getSupplierEventSecondsForClientBadge(r) {
  const status = typeof r.status === 'string' ? r.status : '';
  if (status === LOAN_REQUEST_STATUSES.PENDING) return null;
  if (status === LOAN_REQUEST_STATUSES.CANCELLED_BY_CLIENT) return null;
  if (status === LOAN_REQUEST_STATUSES.COUNTEROFFER_DECLINED) return null;

  const updatedAt = firestoreTimestampSecondsOrNull(r.updatedAt);
  const respondedAt = firestoreTimestampSecondsOrNull(r.respondedAt);
  const counterofferedAt = firestoreTimestampSecondsOrNull(r.counterofferedAt);

  if (status === LOAN_REQUEST_STATUSES.COUNTEROFFER) {
    return maxSecondsOrNull([counterofferedAt, updatedAt]);
  }
  if (status === LOAN_REQUEST_STATUSES.APPROVED) {
    const viaCounteroffer =
      typeof r.approvedAmount === 'number' &&
      typeof r.requestedAmount === 'number' &&
      r.approvedAmount !== r.requestedAmount;
    if (viaCounteroffer) {
      return counterofferedAt;
    }
    return maxSecondsOrNull([respondedAt, updatedAt]);
  }
  if (status === LOAN_REQUEST_STATUSES.REJECTED) {
    return maxSecondsOrNull([respondedAt, updatedAt]);
  }
  if (status === LOAN_REQUEST_STATUSES.UNDER_REVIEW) {
    return maxSecondsOrNull([updatedAt]);
  }
  return maxSecondsOrNull([updatedAt, respondedAt, counterofferedAt]);
}

/**
 * @param {Record<string, unknown>} r
 * @returns {boolean}
 */
export function shouldShowUnreadBadgeForClient(r) {
  const supplierEvt = getSupplierEventSecondsForClientBadge(r);
  if (supplierEvt == null) return false;
  const readSec = firestoreTimestampSecondsOrNull(r.readByClientAt);
  const status = typeof r.status === 'string' ? r.status : '';

  if (readSec != null) {
    return supplierEvt > readSec;
  }

  if (isLoanRequestTerminalStatusV1(status)) {
    return false;
  }

  return true;
}

/**
 * @param {Record<string, unknown>} r
 * @returns {boolean}
 */
function isLoanRequestArchivedForClientSide(r) {
  return firestoreTimestampSecondsOrNull(r.archivedByClientAt) != null;
}

/**
 * @param {Record<string, unknown>} r
 * @returns {boolean}
 */
function isLoanRequestArchivedForSupplierSide(r) {
  return firestoreTimestampSecondsOrNull(r.archivedBySupplierAt) != null;
}

/** @param {Record<string, unknown>} r */
function isPendingUnreadWindowSupplier(r) {
  const sec = firestoreTimestampSecondsOrNull(r.createdAt);
  if (sec == null) return false;
  const age = Math.floor(Date.now() / 1000) - sec;
  return age >= 0 && age <= SUPPLIER_UNREAD_PENDING_MAX_AGE_SEC;
}

/**
 * Último instante de atividade relevante do cliente (badge "Novo" do fornecedor).
 * Espelho de getClientEventSecondsForSupplierBadge em LoanRequestsSupplierPanel.jsx
 * @param {Record<string, unknown>} r
 * @returns {number | null}
 */
export function getClientEventSecondsForSupplierBadge(r) {
  const status = typeof r.status === 'string' ? r.status : '';
  const createdAt = firestoreTimestampSecondsOrNull(r.createdAt);
  const cancelledAt = firestoreTimestampSecondsOrNull(r.cancelledAt);
  const respondedAt = firestoreTimestampSecondsOrNull(r.respondedAt);
  const updatedAt = firestoreTimestampSecondsOrNull(r.updatedAt);

  const candidates = [createdAt];

  if (status === LOAN_REQUEST_STATUSES.CANCELLED_BY_CLIENT) {
    candidates.push(cancelledAt, updatedAt);
    return maxSecondsOrNull(candidates);
  }
  if (status === LOAN_REQUEST_STATUSES.COUNTEROFFER_DECLINED) {
    candidates.push(respondedAt, updatedAt);
    return maxSecondsOrNull(candidates);
  }
  if (status === LOAN_REQUEST_STATUSES.APPROVED) {
    const viaCounteroffer =
      typeof r.approvedAmount === 'number' &&
      typeof r.requestedAmount === 'number' &&
      r.approvedAmount !== r.requestedAmount;
    if (viaCounteroffer) {
      candidates.push(respondedAt, updatedAt);
      return maxSecondsOrNull(candidates);
    }
  }
  return maxSecondsOrNull(candidates);
}

/**
 * @param {Record<string, unknown>} r
 * @returns {boolean}
 */
export function shouldShowUnreadBadgeForSupplier(r) {
  const clientEvt = getClientEventSecondsForSupplierBadge(r);
  if (clientEvt == null) return false;
  const readSec = firestoreTimestampSecondsOrNull(r.readBySupplierAt);
  const status = typeof r.status === 'string' ? r.status : '';
  const isTerminal = isLoanRequestTerminalStatusV1(status);

  if (readSec != null) {
    return clientEvt > readSec;
  }

  if (isTerminal) {
    return false;
  }

  if (status === LOAN_REQUEST_STATUSES.PENDING) {
    return isPendingUnreadWindowSupplier(r);
  }

  return false;
}

/**
 * Conta pedidos com novidade legítima para o papel, alinhado aos badges "Novo" dos painéis.
 * Função pura: sem I/O, sem mutação da lista ou dos itens.
 *
 * @param {unknown} requests
 * @param {unknown} uid
 * @param {unknown} role - "client" | "supplier"
 * @returns {number}
 */
export function countUnreadLoanRequests(requests, uid, role) {
  if (!Array.isArray(requests)) return 0;
  if (typeof uid !== 'string' || uid.length === 0) return 0;
  if (role !== 'client' && role !== 'supplier') return 0;

  let n = 0;
  for (let i = 0; i < requests.length; i += 1) {
    const r = requests[i];
    if (r == null || typeof r !== 'object') continue;

    if (role === 'client') {
      if (r.clientId !== uid) continue;
      if (isLoanRequestArchivedForClientSide(r)) continue;
      if (shouldShowUnreadBadgeForClient(r)) n += 1;
    } else {
      if (r.supplierId !== uid) continue;
      if (isLoanRequestArchivedForSupplierSide(r)) continue;
      if (shouldShowUnreadBadgeForSupplier(r)) n += 1;
    }
  }
  return n;
}
