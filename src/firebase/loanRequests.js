import { normalizeDisplayNameForSnapshot } from '../utils/displayNameSnapshots';

import { USER_ROLES } from './roles';

/** Coleção top-level (v1 pré-financeira). Ver `docs/LOANREQUEST_V1_CONTRATO_FUNCIONAL_SUBFASE1.md`. */
export const LOAN_REQUESTS_COLLECTION = 'loanRequests';

export const LOAN_REQUEST_STATUSES = Object.freeze({
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  COUNTEROFFER: 'counteroffer',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED_BY_CLIENT: 'cancelled_by_client',
  COUNTEROFFER_DECLINED: 'counteroffer_declined',
});

export const LOAN_REQUEST_STATUS_VALUES = Object.freeze(
  Object.values(LOAN_REQUEST_STATUSES),
);

/**
 * Estados “abertos” para duplicidade por linkId (`findOpenLoanRequestForLinkId`): inclui `counteroffer`
 * até o cliente responder.
 */
export const LOAN_REQUEST_OPEN_STATUSES = Object.freeze([
  LOAN_REQUEST_STATUSES.PENDING,
  LOAN_REQUEST_STATUSES.UNDER_REVIEW,
  LOAN_REQUEST_STATUSES.COUNTEROFFER,
]);

export const LOAN_REQUEST_TERMINAL_STATUSES = Object.freeze([
  LOAN_REQUEST_STATUSES.APPROVED,
  LOAN_REQUEST_STATUSES.REJECTED,
  LOAN_REQUEST_STATUSES.CANCELLED_BY_CLIENT,
  LOAN_REQUEST_STATUSES.COUNTEROFFER_DECLINED,
]);

/**
 * Estados em que o cliente pode cancelar o pedido (v1). Não inclui `counteroffer` (v1.1 CN): aí só
 * aceitar ou declinar.
 */
export const LOAN_REQUEST_CLIENT_CANCELLABLE_STATUSES = Object.freeze([
  LOAN_REQUEST_STATUSES.PENDING,
  LOAN_REQUEST_STATUSES.UNDER_REVIEW,
]);

/** Rótulos para UI (pedido na plataforma; não confundir com contrato/financeiro local). */
export const LOAN_REQUEST_STATUS_LABELS_PT = Object.freeze({
  [LOAN_REQUEST_STATUSES.PENDING]: 'Pendente',
  [LOAN_REQUEST_STATUSES.UNDER_REVIEW]: 'Em análise',
  [LOAN_REQUEST_STATUSES.COUNTEROFFER]: 'Contraproposta',
  [LOAN_REQUEST_STATUSES.APPROVED]: 'Aprovado',
  [LOAN_REQUEST_STATUSES.REJECTED]: 'Recusado',
  [LOAN_REQUEST_STATUSES.CANCELLED_BY_CLIENT]: 'Cancelado por você',
  [LOAN_REQUEST_STATUSES.COUNTEROFFER_DECLINED]: 'Contraproposta recusada',
});

/**
 * @param {unknown} status
 */
export function getLoanRequestStatusLabelPt(status) {
  if (typeof status !== 'string') {
    return '';
  }
  return LOAN_REQUEST_STATUS_LABELS_PT[status] ?? status;
}

/**
 * BRL em centavos (inteironos). Subfase 1: 0,01 a 99.999.999,99.
 * @see docs/LOANREQUEST_V1_CONTRATO_FUNCIONAL_SUBFASE1.md
 */
export const LOAN_REQUEST_MIN_AMOUNT_CENTS = 1;
export const LOAN_REQUEST_MAX_AMOUNT_CENTS = 9999999999;

export const LOAN_REQUEST_MAX_NOTE_CHARS = 1000;

/**
 * Campos opcionais para create em loanRequests (ADR identidade pública / snapshots).
 * Preferência: valores no vínculo aprovado; fallback `users/{uid}.displayName` normalizado.
 * Omite chaves quando não há texto útil (evita string vazia e null explícito).
 *
 * @param {Record<string, unknown>} linkData documento `links/{linkId}`
 * @param {Record<string, unknown> | null | undefined} clientProfile `users/{clientId}`
 * @param {Record<string, unknown> | null | undefined} supplierProfile `users/{supplierId}`
 * @returns {{ clientDisplayNameSnapshot?: string; supplierDisplayNameSnapshot?: string }}
 */
export function buildLoanRequestCreateSnapshotFields(
  linkData,
  clientProfile,
  supplierProfile,
) {
  let clientSnap = normalizeDisplayNameForSnapshot(linkData?.clientDisplayNameSnapshot);
  if (clientSnap === null) {
    clientSnap = normalizeDisplayNameForSnapshot(clientProfile?.displayName);
  }

  let supplierSnap = normalizeDisplayNameForSnapshot(linkData?.supplierDisplayNameSnapshot);
  if (supplierSnap === null) {
    supplierSnap = normalizeDisplayNameForSnapshot(supplierProfile?.displayName);
  }

  /** @type {{ clientDisplayNameSnapshot?: string; supplierDisplayNameSnapshot?: string }} */
  const out = {};
  if (clientSnap !== null) out.clientDisplayNameSnapshot = clientSnap;
  if (supplierSnap !== null) out.supplierDisplayNameSnapshot = supplierSnap;
  return out;
}

/** v1.1 RB — só metadado operacional; rules são autoritativas sobre escrita */
export const LOAN_REQUEST_READ_BY_CLIENT_AT_FIELD = 'readByClientAt';
/** v1.1 RB — só metadado operacional; rules são autoritativas sobre escrita */
export const LOAN_REQUEST_READ_BY_SUPPLIER_AT_FIELD = 'readBySupplierAt';

const SUPPLIER_TRANSITIONS = Object.freeze({
  [LOAN_REQUEST_STATUSES.PENDING]: Object.freeze([
    LOAN_REQUEST_STATUSES.UNDER_REVIEW,
    LOAN_REQUEST_STATUSES.APPROVED,
    LOAN_REQUEST_STATUSES.REJECTED,
    LOAN_REQUEST_STATUSES.COUNTEROFFER,
  ]),
  [LOAN_REQUEST_STATUSES.UNDER_REVIEW]: Object.freeze([
    LOAN_REQUEST_STATUSES.APPROVED,
    LOAN_REQUEST_STATUSES.REJECTED,
    LOAN_REQUEST_STATUSES.COUNTEROFFER,
  ]),
});

const CLIENT_TRANSITIONS = Object.freeze({
  [LOAN_REQUEST_STATUSES.PENDING]: Object.freeze([LOAN_REQUEST_STATUSES.CANCELLED_BY_CLIENT]),
  [LOAN_REQUEST_STATUSES.UNDER_REVIEW]: Object.freeze([
    LOAN_REQUEST_STATUSES.CANCELLED_BY_CLIENT,
  ]),
  [LOAN_REQUEST_STATUSES.COUNTEROFFER]: Object.freeze([
    LOAN_REQUEST_STATUSES.APPROVED,
    LOAN_REQUEST_STATUSES.COUNTEROFFER_DECLINED,
  ]),
});

/**
 * @param {unknown} status
 * @returns {status is string}
 */
export function isValidLoanRequestStatusV1(status) {
  return typeof status === 'string' && LOAN_REQUEST_STATUS_VALUES.includes(status);
}

/**
 * @param {unknown} status
 */
export function isLoanRequestTerminalStatusV1(status) {
  return typeof status === 'string' && LOAN_REQUEST_TERMINAL_STATUSES.includes(status);
}

/**
 * @param {unknown} status
 */
export function isLoanRequestOpenStatusV1(status) {
  return typeof status === 'string' && LOAN_REQUEST_OPEN_STATUSES.includes(status);
}

/**
 * Cliente só pode usar “cancelar pedido” em pendente/em análise (nunca em contraposta).
 *
 * @param {unknown} status
 */
export function canClientCancelLoanRequestV1(status) {
  return (
    typeof status === 'string' && LOAN_REQUEST_CLIENT_CANCELLABLE_STATUSES.includes(status)
  );
}

/**
 * Fornecedor: ações de resposta direta (em análise / aprovado direto / recuso) só em pendente ou em análise.
 *
 * @param {unknown} status
 */
export function isLoanRequestSupplierNegotiationStatesV1(status) {
  return (
    typeof status === 'string' &&
    (status === LOAN_REQUEST_STATUSES.PENDING ||
      status === LOAN_REQUEST_STATUSES.UNDER_REVIEW)
  );
}

/**
 * Transições de status nos helpers JS (mirror parcial das rules; não substitui validação servidor).
 *
 * @param {'supplier' | 'client'} actorRole
 * @param {string} currentStatus
 * @param {string} nextStatus
 */
export function canActorTransitionLoanRequestV1(actorRole, currentStatus, nextStatus) {
  if (actorRole !== USER_ROLES.SUPPLIER && actorRole !== USER_ROLES.CLIENT) {
    return false;
  }
  if (!isValidLoanRequestStatusV1(currentStatus) || !isValidLoanRequestStatusV1(nextStatus)) {
    return false;
  }
  if (currentStatus === nextStatus) {
    return false;
  }
  if (actorRole === USER_ROLES.SUPPLIER) {
    return SUPPLIER_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
  }
  return CLIENT_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
}
