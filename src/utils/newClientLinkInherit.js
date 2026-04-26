import { buildLocalLinkContext } from './linkContext';
import { LINK_LIST_FILTER } from './clientLinkListFilter';

/**
 * Indica se o contexto da lista (filtros) permite herdar anotação de vínculo ao criar cliente.
 * Não herda no modo "Sem anotação" nem sem vínculo específico selecionado.
 *
 * @param {string} linkFilter
 * @param {string} [localLinkId]
 * @returns {boolean}
 */
export function isEligibleForLinkContextInheritOnCreate(linkFilter, localLinkId) {
  if (linkFilter === LINK_LIST_FILTER.UNLINKED) return false;
  if (typeof localLinkId !== 'string' || !localLinkId) return false;
  return true;
}

/**
 * Obtém um linkContext de referência a partir de qualquer cliente local que compartilhe o linkId.
 * Usado só para copiar supplierId/clientId; o novo registro recebe `associatedAt` via buildLocalLinkContext.
 *
 * @param {Array} clients
 * @param {string} linkFilter
 * @param {string} [localLinkId]
 * @returns {Record<string, unknown> | null}
 */
export function getLinkContextTemplateForInheritFromClients(clients, linkFilter, localLinkId) {
  if (!isEligibleForLinkContextInheritOnCreate(linkFilter, localLinkId)) return null;
  if (!Array.isArray(clients)) return null;
  const found = clients.find((c) => c?.linkContext?.linkId === localLinkId);
  if (!found?.linkContext) return null;
  const t = found.linkContext;
  if (typeof t.supplierId !== 'string' || typeof t.clientId !== 'string' || !t.supplierId || !t.clientId) {
    return null;
  }
  return t;
}

/**
 * @param {Object} p
 * @param {string} p.id
 * @param {string} p.name
 * @param {Array} [p.loans]
 * @param {boolean} p.includeLinkContext
 * @param {Record<string, unknown> | null} [p.templateLinkContext]
 * @returns {{ id: string, name: string, loans: Array, linkContext?: object }}
 */
export function buildNewClientWithOptionalLinkContext({
  id,
  name,
  loans = [],
  includeLinkContext,
  templateLinkContext,
}) {
  const base = { id, name, loans };
  if (!includeLinkContext || !templateLinkContext) return base;
  const t = templateLinkContext;
  if (typeof t.supplierId !== 'string' || typeof t.clientId !== 'string' || !t.supplierId || !t.clientId) {
    return base;
  }
  return {
    ...base,
    linkContext: buildLocalLinkContext(t.supplierId, t.clientId),
  };
}
