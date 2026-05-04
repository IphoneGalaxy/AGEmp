/**
 * Derivadores puros para a revisão de conversão LoanRequest → contrato local (Bloco 2).
 * Sem I/O nem efeitos colaterais.
 */

import { deriveLoanRequestClientFriendlyName } from './displayNameSnapshots';

/**
 * Rótulo do cliente no modal de revisão (snapshot → «Cliente da plataforma»).
 *
 * @param {Record<string, unknown> | null | undefined} request
 * @returns {string}
 */
export function deriveLoanRequestConversionReviewClientLabel(request) {
  return deriveLoanRequestClientFriendlyName(request);
}

/**
 * Mesma ideia que novos contratos em ClientView / App: string vazia ou ausência → 10%.
 *
 * @param {unknown} settingsLike objeto com `defaultInterestRate` ou `undefined`.
 */
export function effectiveDefaultInterestRateFromSettings(settingsLike) {
  const r = settingsLike?.defaultInterestRate;
  if (r === '' || r == null) return 10;
  const n = Number(r);
  return Number.isFinite(n) ? n : 10;
}

/**
 * Rótulo de cliente quando só há UID remoto (ADR Bloco 2 — fallback).
 *
 * @param {unknown} clientId
 * @returns {string}
 */
export function deriveLoanRequestClientDisplayLabel(clientId) {
  if (typeof clientId !== 'string' || !clientId.trim()) {
    return 'Cliente (UID indisponível)';
  }
  const id = clientId.trim();
  const short = id.length > 8 ? `${id.slice(0, 8)}…` : id;
  return `Cliente ${short}`;
}

/**
 * @param {unknown} cents valor em centavos Firestore (`approvedAmount`)
 * @returns {number | null} valor em reais ou null se inválido
 */
export function approvedAmountCentsToReaisOrNull(cents) {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return null;
  return cents / 100;
}
