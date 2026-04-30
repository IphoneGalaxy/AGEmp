/**
 * Derivação local para leitura operacional de vínculos dentro do detalhe do cliente.
 * Não altera storage, cálculos, pagamentos, caixa ou dashboard.
 */

export const LOAN_LINK_CONTEXT_RELATION = Object.freeze({
  SAME_AS_CLIENT: 'same-as-client',
  DIFFERENT_FROM_CLIENT: 'different-from-client',
  LINKED_WITHOUT_CLIENT: 'linked-without-client',
  UNLINKED: 'unlinked',
});

const getLinkId = (linkContext) =>
  linkContext && typeof linkContext.linkId === 'string' && linkContext.linkId.length > 0
    ? linkContext.linkId
    : null;

/**
 * Classifica a anotação local do contrato em relação ao vínculo local do cliente.
 *
 * @param {Record<string, unknown> | null | undefined} loan
 * @param {Record<string, unknown> | null | undefined} clientLinkContext
 * @returns {string}
 */
export function classifyLoanLinkContextRelation(loan, clientLinkContext) {
  const loanLinkId = getLinkId(loan?.linkContext);
  if (!loanLinkId) return LOAN_LINK_CONTEXT_RELATION.UNLINKED;

  const clientLinkId = getLinkId(clientLinkContext);
  if (!clientLinkId) return LOAN_LINK_CONTEXT_RELATION.LINKED_WITHOUT_CLIENT;

  return loanLinkId === clientLinkId
    ? LOAN_LINK_CONTEXT_RELATION.SAME_AS_CLIENT
    : LOAN_LINK_CONTEXT_RELATION.DIFFERENT_FROM_CLIENT;
}

/**
 * Resume a leitura operacional local de contratos por vínculo no contexto de um cliente.
 *
 * @param {Record<string, unknown> | null | undefined} clientLinkContext
 * @param {Array<Record<string, unknown>>} loans
 */
export function summarizeClientLoanLinkContext(clientLinkContext, loans) {
  const list = Array.isArray(loans) ? loans : [];
  const summary = {
    total: list.length,
    sameAsClient: 0,
    differentFromClient: 0,
    linkedWithoutClient: 0,
    unlinked: 0,
    linked: 0,
  };

  list.forEach((loan) => {
    const relation = classifyLoanLinkContextRelation(loan, clientLinkContext);
    if (relation === LOAN_LINK_CONTEXT_RELATION.SAME_AS_CLIENT) {
      summary.sameAsClient += 1;
      summary.linked += 1;
      return;
    }
    if (relation === LOAN_LINK_CONTEXT_RELATION.DIFFERENT_FROM_CLIENT) {
      summary.differentFromClient += 1;
      summary.linked += 1;
      return;
    }
    if (relation === LOAN_LINK_CONTEXT_RELATION.LINKED_WITHOUT_CLIENT) {
      summary.linkedWithoutClient += 1;
      summary.linked += 1;
      return;
    }
    summary.unlinked += 1;
  });

  return summary;
}
