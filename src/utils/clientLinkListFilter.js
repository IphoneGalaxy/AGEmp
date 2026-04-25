/**
 * Filtro local da lista de clientes por presença de `linkContext` (metadado opcional).
 * Não afeta cálculos financeiros; apenas organização de UI.
 */

export const LINK_LIST_FILTER = Object.freeze({
  ALL: 'all',
  LINKED: 'linked',
  UNLINKED: 'unlinked',
});

/**
 * @param {Array} clients - lista de clientes (brutos ou processados; usa apenas linkContext)
 * @param {string} filter - 'all' | 'linked' | 'unlinked'
 * @returns {Array}
 */
export function filterClientsByLinkContextPresence(clients, filter) {
  if (!Array.isArray(clients)) return [];
  if (filter === LINK_LIST_FILTER.LINKED) {
    return clients.filter((c) => c && c.linkContext);
  }
  if (filter === LINK_LIST_FILTER.UNLINKED) {
    return clients.filter((c) => c && !c.linkContext);
  }
  return clients;
}
