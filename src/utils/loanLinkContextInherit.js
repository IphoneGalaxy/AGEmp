import { buildLocalLinkContext } from './linkContext';

/**
 * Herança local opcional de linkContext no nível de contrato.
 * Apenas metadado de organização; não altera cálculos nem inicia sync remoto.
 */

/**
 * @param {Record<string, unknown> | null | undefined} clientLinkContext
 * @returns {boolean}
 */
export function canInheritLinkContextToLoan(clientLinkContext) {
  if (!clientLinkContext || typeof clientLinkContext !== 'object') return false;
  return (
    typeof clientLinkContext.supplierId === 'string' &&
    clientLinkContext.supplierId.length > 0 &&
    typeof clientLinkContext.clientId === 'string' &&
    clientLinkContext.clientId.length > 0
  );
}

/**
 * Constrói um novo linkContext para o contrato a partir do contexto do cliente.
 * O contrato recebe `associatedAt` próprio, no momento da criação.
 *
 * @param {Record<string, unknown> | null | undefined} clientLinkContext
 * @returns {ReturnType<typeof buildLocalLinkContext> | null}
 */
export function buildLoanLinkContextFromClient(clientLinkContext) {
  if (!canInheritLinkContextToLoan(clientLinkContext)) return null;
  return buildLocalLinkContext(clientLinkContext.supplierId, clientLinkContext.clientId);
}

/**
 * @param {Object} p
 * @param {Object} p.loan
 * @param {Record<string, unknown> | null | undefined} p.clientLinkContext
 * @param {boolean} p.includeLinkContext
 * @returns {Object}
 */
export function buildLoanWithOptionalLinkContext({
  loan,
  clientLinkContext,
  includeLinkContext,
}) {
  const base = { ...loan };
  if (!includeLinkContext) return base;
  const linkContext = buildLoanLinkContextFromClient(clientLinkContext);
  if (!linkContext) return base;
  return { ...base, linkContext };
}
