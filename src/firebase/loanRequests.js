import { USER_ROLES } from './roles';

/** Coleção top-level (v1 pré-financeira). Ver `docs/LOANREQUEST_V1_CONTRATO_FUNCIONAL_SUBFASE1.md`. */
export const LOAN_REQUESTS_COLLECTION = 'loanRequests';

export const LOAN_REQUEST_STATUSES = Object.freeze({
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED_BY_CLIENT: 'cancelled_by_client',
});

export const LOAN_REQUEST_STATUS_VALUES = Object.freeze(
  Object.values(LOAN_REQUEST_STATUSES),
);

/** Estados com pedido ainda “aberto” (regra de duplicidade por linkId). */
export const LOAN_REQUEST_OPEN_STATUSES = Object.freeze([
  LOAN_REQUEST_STATUSES.PENDING,
  LOAN_REQUEST_STATUSES.UNDER_REVIEW,
]);

export const LOAN_REQUEST_TERMINAL_STATUSES = Object.freeze([
  LOAN_REQUEST_STATUSES.APPROVED,
  LOAN_REQUEST_STATUSES.REJECTED,
  LOAN_REQUEST_STATUSES.CANCELLED_BY_CLIENT,
]);

/** Rótulos para UI (pedido na plataforma; não confundir com contrato/financeiro local). */
export const LOAN_REQUEST_STATUS_LABELS_PT = Object.freeze({
  [LOAN_REQUEST_STATUSES.PENDING]: 'Pendente',
  [LOAN_REQUEST_STATUSES.UNDER_REVIEW]: 'Em análise',
  [LOAN_REQUEST_STATUSES.APPROVED]: 'Aprovado',
  [LOAN_REQUEST_STATUSES.REJECTED]: 'Recusado',
  [LOAN_REQUEST_STATUSES.CANCELLED_BY_CLIENT]: 'Cancelado por você',
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

const SUPPLIER_TRANSITIONS = Object.freeze({
  [LOAN_REQUEST_STATUSES.PENDING]: Object.freeze([
    LOAN_REQUEST_STATUSES.UNDER_REVIEW,
    LOAN_REQUEST_STATUSES.APPROVED,
    LOAN_REQUEST_STATUSES.REJECTED,
  ]),
  [LOAN_REQUEST_STATUSES.UNDER_REVIEW]: Object.freeze([
    LOAN_REQUEST_STATUSES.APPROVED,
    LOAN_REQUEST_STATUSES.REJECTED,
  ]),
});

const CLIENT_TRANSITIONS = Object.freeze({
  [LOAN_REQUEST_STATUSES.PENDING]: Object.freeze([LOAN_REQUEST_STATUSES.CANCELLED_BY_CLIENT]),
  [LOAN_REQUEST_STATUSES.UNDER_REVIEW]: Object.freeze([
    LOAN_REQUEST_STATUSES.CANCELLED_BY_CLIENT,
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
 * Transições de status permitidas pelo contrato v1 (sem UI aqui).
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
