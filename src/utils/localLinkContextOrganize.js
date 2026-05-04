/**
 * Organização e rótulos locais derivados apenas de `linkContext` no cliente.
 * Não acessa Firestore nem altera cálculos financeiros.
 */

import { LOCAL_LINK_CONTEXT_FRIENDLY_LINE_COMPLETE } from './platformFriendlyLabels';

/**
 * Mascaramento mínimo de UID longo (somente exibição local).
 * @param {string} [uid]
 * @returns {string}
 */
export function maskUidForLocalLabel(uid) {
  if (typeof uid !== 'string' || !uid) return '—';
  if (uid.length <= 8) return uid;
  return `${uid.slice(0, 4)}…${uid.slice(-4)}`;
}

/**
 * Uma linha curta e humana a partir de supplierId/cliente do linkContext v1.
 * @param {Record<string, unknown> | null | undefined} lc
 * @returns {string}
 */
export function formatLocalVinculoLineFromContext(lc) {
  if (!lc || typeof lc !== 'object') return '';
  const s = lc.supplierId;
  const cl = lc.clientId;
  if (typeof s !== 'string' || typeof cl !== 'string' || !s || !cl) {
    return 'Anotação de vínculo (local)';
  }
  return LOCAL_LINK_CONTEXT_FRIENDLY_LINE_COMPLETE;
}

/**
 * Uma opção de vínculo distinto a partir do conjunto local de clientes.
 * @typedef {{ linkId: string, count: number, label: string }} LocalLinkOption
 */

/**
 * Lista vínculos distintos presentes em clientes (linkContext v1), com contagem.
 * @param {Array} clients
 * @returns {LocalLinkOption[]}
 */
export function listDistinctLocalLinkOptions(clients) {
  if (!Array.isArray(clients)) return [];
  const byId = new Map();
  for (const c of clients) {
    const lc = c?.linkContext;
    const lid = lc?.linkId;
    if (typeof lid !== 'string' || !lid) continue;
    if (!byId.has(lid)) {
      byId.set(lid, { linkId: lid, count: 0, label: formatLocalVinculoLineFromContext(lc) });
    }
    const row = byId.get(lid);
    row.count += 1;
  }
  return Array.from(byId.values()).sort((a, b) => a.linkId.localeCompare(b.linkId, 'en'));
}

/**
 * Filtra clientes cujo `linkContext.linkId` é igual a `linkId` (ou não filtra se linkId vazio).
 * @param {Array} clients
 * @param {string} [linkId]
 * @returns {Array}
 */
export function filterClientsByLocalLinkId(clients, linkId) {
  if (!Array.isArray(clients)) return [];
  if (typeof linkId !== 'string' || !linkId) return clients;
  return clients.filter((c) => c?.linkContext?.linkId === linkId);
}

/**
 * Conta clientes com linkContext.
 * @param {Array} clients
 * @returns {number}
 */
export function countClientsWithLinkContext(clients) {
  if (!Array.isArray(clients)) return 0;
  return clients.filter((c) => c && c.linkContext).length;
}
