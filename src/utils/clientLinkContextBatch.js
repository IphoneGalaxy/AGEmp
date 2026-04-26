import { buildLocalLinkContext } from './linkContext';
import { LINK_LIST_FILTER } from './clientLinkListFilter';

/**
 * Ações em lote de anotação de vínculo (linkContext v1) na lista de clientes.
 * Apenas metadado local; não afeta cálculos nem nuvem.
 */

/**
 * Só oferece anotação em lote com o vínculo do refinamento quando há linkId ativo
 * e o filtro não exige "sem anotação".
 *
 * @param {string} linkFilter
 * @param {string} [localLinkId]
 * @returns {boolean}
 */
export function isBatchLinkAnnotateEligible(linkFilter, localLinkId) {
  if (linkFilter === LINK_LIST_FILTER.UNLINKED) return false;
  if (typeof localLinkId !== 'string' || !localLinkId) return false;
  return true;
}

/**
 * Garante que o template (supplier/client) corresponde ao linkId ativo do refinamento.
 *
 * @param {string | null} [templateSupplierId]
 * @param {string | null} [templateClientId]
 * @param {string} localLinkId
 * @returns {boolean}
 */
export function isTemplateConsistentWithLinkId(
  templateSupplierId,
  templateClientId,
  localLinkId
) {
  if (typeof localLinkId !== 'string' || !localLinkId) return false;
  if (typeof templateSupplierId !== 'string' || !templateSupplierId) return false;
  if (typeof templateClientId !== 'string' || !templateClientId) return false;
  const t = buildLocalLinkContext(templateSupplierId, templateClientId);
  return t.linkId === localLinkId;
}

/**
 * Aplica linkContext v1 (novo `associatedAt` por cliente) aos selecionados.
 * Comportamento conservador: mantém inalterado quem já tem outro vínculo; não sobrescreve.
 *
 * @param {Object} p
 * @param {Array} p.allClients
 * @param {string[]} p.selectedIds
 * @param {string} p.targetSupplierId
 * @param {string} p.targetClientId
 * @returns {{ nextClients: Array, applied: number, alreadySame: number, skippedOther: number }}
 */
export function applyLinkContextToClientsBatch({
  allClients,
  selectedIds,
  targetSupplierId,
  targetClientId,
}) {
  if (!Array.isArray(allClients)) {
    return { nextClients: [], applied: 0, alreadySame: 0, skippedOther: 0 };
  }
  if (typeof targetSupplierId !== 'string' || !targetSupplierId) {
    return { nextClients: allClients, applied: 0, alreadySame: 0, skippedOther: 0 };
  }
  if (typeof targetClientId !== 'string' || !targetClientId) {
    return { nextClients: allClients, applied: 0, alreadySame: 0, skippedOther: 0 };
  }
  const targetPre = buildLocalLinkContext(targetSupplierId, targetClientId);
  const targetLinkId = targetPre.linkId;

  const idSet = new Set(Array.isArray(selectedIds) ? selectedIds.filter(Boolean) : []);
  if (idSet.size === 0) {
    return { nextClients: allClients, applied: 0, alreadySame: 0, skippedOther: 0 };
  }

  let applied = 0;
  let alreadySame = 0;
  let skippedOther = 0;

  const nextClients = allClients.map((c) => {
    if (!c || !idSet.has(c.id)) {
      return c;
    }
    const lc = c.linkContext;
    if (lc && typeof lc === 'object' && typeof lc.linkId === 'string' && lc.linkId) {
      if (lc.linkId === targetLinkId) {
        alreadySame += 1;
        return c;
      }
      skippedOther += 1;
      return c;
    }
    applied += 1;
    return {
      ...c,
      linkContext: buildLocalLinkContext(targetSupplierId, targetClientId),
    };
  });

  return { nextClients, applied, alreadySame, skippedOther };
}

function stripLinkContext(client) {
  const next = { ...client };
  delete next.linkContext;
  return next;
}

/**
 * Remove somente `linkContext` dos clientes selecionados que têm.
 *
 * @param {Object} p
 * @param {Array} p.allClients
 * @param {string[]} p.selectedIds
 * @returns {{ nextClients: Array, removed: number, hadNone: number }}
 */
export function removeLinkContextFromClientsBatch({ allClients, selectedIds }) {
  if (!Array.isArray(allClients)) {
    return { nextClients: [], removed: 0, hadNone: 0 };
  }
  const idSet = new Set(Array.isArray(selectedIds) ? selectedIds.filter(Boolean) : []);
  if (idSet.size === 0) {
    return { nextClients: allClients, removed: 0, hadNone: 0 };
  }

  let removed = 0;
  let hadNone = 0;

  const nextClients = allClients.map((c) => {
    if (!c || !idSet.has(c.id)) {
      return c;
    }
    if (c.linkContext) {
      removed += 1;
      return stripLinkContext(c);
    }
    hadNone += 1;
    return c;
  });

  return { nextClients, removed, hadNone };
}
