/**
 * Derivações puras para visão operacional local por vínculo (linkId).
 *
 * Combina apenas dados já presentes em clientes/contratos locais (`client.linkContext`,
 * `loan.linkContext`; pagamentos apenas como contagens sobre `loan.payments`).
 *
 * - Não acessa Firebase / Firestore
 * - Não altera cálculos financeiros nem lê resultado de calculations.js
 * - Não persiste payment.linkContext
 */

import { formatLocalVinculoLineFromContext } from './localLinkContextOrganize';

/**
 * @typedef {Object} OperationalLinkOption
 * @property {string} linkId
 * @property {string} label Rótulo curto derivado do linkContext (exibição)
 * @property {number} clientCount Clientes cuja própria anotação (client.linkContext) usa este linkId
 * @property {number} loanCount Contratos com loan.linkContext com este linkId
 * @property {number} paymentCount Soma das quantidades de pagamentos apenas em loans com este loan.linkContext
 */

/**
 * @param {Record<string, unknown> | null | undefined} lc
 * @returns {string|null}
 */
function linkIdFromContext(lc) {
  if (!lc || typeof lc !== 'object') return null;
  const lid = lc.linkId;
  return typeof lid === 'string' && lid.trim() !== '' ? lid : null;
}

/**
 * Garante linha por linkId com rótulo derivado na primeira vez.
 * @param {Map<string, OperationalLinkOption>} map
 * @param {string} linkId
 * @param {Record<string, unknown> | null | undefined} lc
 * @returns {OperationalLinkOption|undefined}
 */
function ensureRow(map, linkId, lc) {
  if (!map.has(linkId)) {
    const lab = lc ? formatLocalVinculoLineFromContext(lc).trim() : '';
    map.set(linkId, {
      linkId,
      label: lab || linkId,
      clientCount: 0,
      loanCount: 0,
      paymentCount: 0,
    });
  }
  return map.get(linkId);
}

/**
 * Opções por linkId observadas nos dados locais, com contagens operacionais.
 *
 * Um link pode aparecer só em clientes, só em contratos, ou em ambos.
 *
 * @param {unknown[]|undefined|null} clients
 * @returns {OperationalLinkOption[]}
 */
export function listOperationalLinkOptions(clients) {
  if (!Array.isArray(clients)) return [];

  /** @type {Map<string, OperationalLinkOption>} */
  const map = new Map();

  for (const c of clients) {
    if (!c || typeof c !== 'object') continue;

    const cid = linkIdFromContext(c.linkContext);
    if (cid) {
      ensureRow(map, cid, c.linkContext);
      const row = map.get(cid);
      if (row) row.clientCount += 1;
    }

    const loans = Array.isArray(c.loans) ? c.loans : [];
    for (const loan of loans) {
      if (!loan || typeof loan !== 'object') continue;
      const lid = linkIdFromContext(loan.linkContext);
      if (!lid) continue;
      ensureRow(map, lid, loan.linkContext);
      const row = map.get(lid);
      if (row) {
        row.loanCount += 1;
        const pays = loan.payments;
        const n = Array.isArray(pays) ? pays.length : 0;
        row.paymentCount += n;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.linkId.localeCompare(b.linkId, 'en'));
}

/**
 * Obtém uma opção já agregada para um linkId, ou null se inexistente.
 *
 * @param {OperationalLinkOption[]} options
 * @param {string} linkId
 * @returns {OperationalLinkOption|null}
 */
export function findOperationalLinkOption(options, linkId) {
  if (!Array.isArray(options) || typeof linkId !== 'string' || !linkId) return null;
  return options.find((o) => o.linkId === linkId) ?? null;
}
