/**
 * Contexto de vínculo mostrado junto aos pagamentos é derivado apenas do contrato
 * (`loan.linkContext`). Não persiste `payment.linkContext` nem usa `client.linkContext`.
 */

/**
 * Retorna o snapshot local do contrato a ser exibido como contexto nos pagamentos,
 * ou `null` se não houver anotação no contrato.
 *
 * @param {Record<string, unknown> | null | undefined} loan
 * @returns {Record<string, unknown> | null}
 */
export function getLoanLinkContextForPaymentDisplay(loan) {
  if (!loan || typeof loan !== 'object') return null;
  const lc = loan.linkContext;
  if (!lc || typeof lc !== 'object') return null;
  return lc;
}
