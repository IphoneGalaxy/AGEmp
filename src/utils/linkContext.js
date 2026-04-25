import { getLinkId } from '../firebase/links.js';

export const LINK_CONTEXT_VERSION = 1;

/**
 * Metadado local opcional: associa um cliente financeiro a um vínculo aprovado na plataforma.
 * Não altera cálculos; não inicia sync remoto.
 *
 * @param {string} supplierId
 * @param {string} clientId
 */
export function buildLocalLinkContext(supplierId, clientId) {
  return {
    version: LINK_CONTEXT_VERSION,
    linkId: getLinkId(supplierId, clientId),
    supplierId,
    clientId,
    associatedAt: new Date().toISOString(),
  };
}
