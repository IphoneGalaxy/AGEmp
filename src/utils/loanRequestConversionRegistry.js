/**
 * Registry local de conversões LoanRequest → contrato (histórico neste aparelho).
 * Separado de `clients[]` e de `archivedAt` — apenas metadado para UX e anti-confusão.
 */

/** @typedef {{ loanRequestId: string; convertedAt: string; supplierId: string; clientId: string; localClientId: string; localLoanId: string; amountCents?: number; clientDisplayNameSnapshot?: string }} LoanRequestConversionRegistryEntry */

/**
 * @param {unknown} raw
 * @returns {LoanRequestConversionRegistryEntry[]}
 */
export function normalizeLoanRequestConversionRegistry(raw) {
  if (!Array.isArray(raw)) return [];
  /** @type {LoanRequestConversionRegistryEntry[]} */
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const loanRequestId =
      typeof item.loanRequestId === 'string' ? item.loanRequestId.trim() : '';
    const convertedAt =
      typeof item.convertedAt === 'string' ? item.convertedAt.trim() : '';
    const supplierId =
      typeof item.supplierId === 'string' ? item.supplierId.trim() : '';
    const clientId =
      typeof item.clientId === 'string' ? item.clientId.trim() : '';
    const localClientId =
      typeof item.localClientId === 'string' ? item.localClientId.trim() : '';
    const localLoanId =
      typeof item.localLoanId === 'string' ? item.localLoanId.trim() : '';
    if (
      !loanRequestId ||
      !convertedAt ||
      !supplierId ||
      !clientId ||
      !localClientId ||
      !localLoanId
    ) {
      continue;
    }
    /** @type {LoanRequestConversionRegistryEntry} */
    const entry = {
      loanRequestId,
      convertedAt,
      supplierId,
      clientId,
      localClientId,
      localLoanId,
    };
    if (
      typeof item.amountCents === 'number' &&
      Number.isFinite(item.amountCents) &&
      item.amountCents >= 0
    ) {
      entry.amountCents = Math.round(item.amountCents);
    }
    if (
      typeof item.clientDisplayNameSnapshot === 'string' &&
      item.clientDisplayNameSnapshot.trim().length > 0
    ) {
      entry.clientDisplayNameSnapshot = item.clientDisplayNameSnapshot.trim();
    }
    out.push(entry);
  }
  return out;
}

/**
 * Substitui ou acrescenta entrada pelo `loanRequestId`.
 *
 * @param {LoanRequestConversionRegistryEntry[]} registry
 * @param {LoanRequestConversionRegistryEntry} entry
 * @returns {LoanRequestConversionRegistryEntry[]}
 */
export function upsertLoanRequestConversionRegistryEntry(registry, entry) {
  const base = normalizeLoanRequestConversionRegistry(registry);
  const id = entry.loanRequestId.trim();
  const filtered = base.filter((e) => e.loanRequestId !== id);
  return [...filtered, entry];
}

/**
 * @param {unknown[]} registry
 * @param {string} loanRequestId
 * @returns {LoanRequestConversionRegistryEntry | undefined}
 */
export function findLoanRequestConversionRegistryEntry(registry, loanRequestId) {
  const id =
    typeof loanRequestId === 'string' ? loanRequestId.trim() : '';
  if (!id) return undefined;
  const list = normalizeLoanRequestConversionRegistry(registry);
  return list.find((e) => e.loanRequestId === id);
}

/**
 * Histórico local existe, mas não há contrato atual marcando este pedido.
 *
 * @param {unknown[]} registry
 * @param {unknown[]} clients
 * @param {string} loanRequestId
 * @param {(list: unknown[], id: string) => boolean} hasLiveConvertedLoan — ex.: hasConvertedLoanRequestDuplicate
 */
export function hasHistoricalLoanRequestConversionWithoutLiveLoan(
  registry,
  clients,
  loanRequestId,
  hasLiveConvertedLoan,
) {
  const hit = findLoanRequestConversionRegistryEntry(registry, loanRequestId);
  if (!hit) return false;
  return !hasLiveConvertedLoan(clients, loanRequestId);
}
