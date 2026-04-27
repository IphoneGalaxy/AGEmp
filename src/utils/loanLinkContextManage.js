import {
  buildLoanLinkContextFromClient,
  canInheritLinkContextToLoan,
} from './loanLinkContextInherit';

/**
 * Gestão local opcional de `loan.linkContext` (anotação de vínculo no contrato).
 * Não afeta cálculos financeiros, pagamentos, caixa ou dashboard.
 */

/**
 * Pode anotar o contrato com snapshot derivado de `client.linkContext` quando
 * o contrato ainda não tem anotação e o contexto do cliente é válido.
 *
 * @param {Record<string, unknown> | null | undefined} loan
 * @param {Record<string, unknown> | null | undefined} clientLinkContext
 * @returns {boolean}
 */
export function canAnnotateLoanFromClientContext(loan, clientLinkContext) {
  if (!loan || typeof loan !== 'object') return false;
  if (loan.linkContext) return false;
  return canInheritLinkContextToLoan(clientLinkContext);
}

/**
 * Anexa `linkContext` v1 ao contrato (novo `associatedAt` no snapshot).
 * Se não puder anotar, retorna a mesma referência do `loan` (no-op idempotente).
 *
 * @param {Record<string, unknown>} loan
 * @param {Record<string, unknown> | null | undefined} clientLinkContext
 * @returns {Record<string, unknown>}
 */
export function annotateLoanFromClientContext(loan, clientLinkContext) {
  if (!canAnnotateLoanFromClientContext(loan, clientLinkContext)) {
    return loan;
  }
  const linkContext = buildLoanLinkContextFromClient(clientLinkContext);
  if (!linkContext) {
    return loan;
  }
  return { ...loan, linkContext };
}

/**
 * Remove somente o metadado `linkContext` do contrato, preservando demais campos.
 *
 * @param {Record<string, unknown> | null | undefined} loan
 * @returns {Record<string, unknown>}
 */
export function removeLoanLinkContext(loan) {
  if (!loan || typeof loan !== 'object' || !loan.linkContext) {
    return /** @type {Record<string, unknown>} */ (loan);
  }
  const { linkContext: _removed, ...rest } = loan;
  return { ...rest };
}

/**
 * @param {Record<string, unknown> | null | undefined} loan
 * @param {Record<string, unknown> | null | undefined} clientLinkContext
 * @returns {{ canAdd: boolean; canRemove: boolean }}
 */
export function getLoanLinkContextActionState(loan, clientLinkContext) {
  return {
    canAdd: canAnnotateLoanFromClientContext(loan, clientLinkContext),
    canRemove: Boolean(loan && typeof loan === 'object' && loan.linkContext),
  };
}
