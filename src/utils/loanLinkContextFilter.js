/**
 * Filtro local de contratos (empréstimos) por presença de `loan.linkContext`.
 * Não afeta cálculos financeiros; apenas organização de UI no detalhe do cliente.
 * fonte: apenas `linkContext` do próprio contrato, sem inferir do cliente.
 */

export const LOAN_LINK_LIST_FILTER = Object.freeze({
  ALL: 'all',
  LINKED: 'linked',
  UNLINKED: 'unlinked',
});

/**
 * @param {Array} loans
 * @param {string} filter - 'all' | 'linked' | 'unlinked'
 * @returns {Array}
 */
export function filterLoansByLinkContextPresence(loans, filter) {
  if (!Array.isArray(loans)) return [];
  if (filter === LOAN_LINK_LIST_FILTER.LINKED) {
    return loans.filter((l) => l && l.linkContext);
  }
  if (filter === LOAN_LINK_LIST_FILTER.UNLINKED) {
    return loans.filter((l) => l && !l.linkContext);
  }
  return loans;
}

/**
 * @param {Array} loans
 * @returns {number}
 */
export function countLoansWithLinkContext(loans) {
  if (!Array.isArray(loans)) return 0;
  return loans.filter((l) => l && l.linkContext).length;
}

/**
 * @param {Array} loans
 * @returns {number}
 */
export function countLoansWithoutLinkContext(loans) {
  if (!Array.isArray(loans)) return 0;
  return loans.filter((l) => l && !l.linkContext).length;
}

/**
 * Exibe o bloco de filtro quando há mais de um contrato ou existe ao menos um anotado.
 *
 * @param {Array} loans
 * @returns {boolean}
 */
export function shouldShowLoanLinkContextFilter(loans) {
  if (!Array.isArray(loans) || loans.length === 0) return false;
  if (loans.length > 1) return true;
  return Boolean(loans[0] && loans[0].linkContext);
}
