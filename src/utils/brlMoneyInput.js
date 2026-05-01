/**
 * Entrada de valor em BRL para armazenamento em centavos (inteiro).
 * Uso na UI pré-financeira remota (loanRequest).
 */

/**
 * @param {string|number|undefined|null} raw
 * @param {{ minCents?: number; maxCents?: number }} [bounds]
 * @returns {{ ok: true; cents: number } | { ok: false; message: string }}
 */
export function parseBrlMoneyInputToCents(raw, bounds) {
  const minCents = bounds?.minCents ?? 1;
  const maxCents = bounds?.maxCents ?? 9999999999;

  const t = String(raw ?? '')
    .trim()
    .replace(/\s/g, '');
  if (!t) {
    return { ok: false, message: 'Informe um valor.' };
  }

  let normalized;
  if (t.includes(',')) {
    normalized = t.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = t;
  }

  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, message: 'Valor numérico inválido.' };
  }

  const cents = Math.round(n * 100);
  if (!Number.isFinite(cents)) {
    return { ok: false, message: 'Valor numérico inválido.' };
  }
  if (cents < minCents) {
    return {
      ok: false,
      message: `O valor mínimo é ${(minCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
    };
  }
  if (cents > maxCents) {
    return { ok: false, message: 'Valor acima do limite permitido para um pedido.' };
  }

  return { ok: true, cents };
}

/**
 * Normaliza observação do cliente/fornecedor (quebras de linha e tamanho).
 *
 * @param {string|undefined|null} raw
 * @param {number} maxChars
 */
export function normalizeNoteForLoanRequest(raw, maxChars) {
  let s = String(raw ?? '').replace(/\r\n/g, '\n');
  s = s.trim();
  if (s.length > maxChars) {
    s = s.slice(0, maxChars);
  }
  return s;
}
