/**
 * Agrupa pedidos do cliente por `supplierId` (Firestore). Ignora registos sem supplier válido.
 *
 * @param {Array<Record<string, unknown>>} requests
 * @returns {Record<string, Array<Record<string, unknown>>>}
 */
export function groupLoanRequestsBySupplierId(requests) {
  /** @type {Record<string, Array<Record<string, unknown>>>} */
  const out = {};
  for (const r of requests ?? []) {
    const sid = typeof r.supplierId === 'string' ? r.supplierId.trim() : '';
    if (!sid) continue;
    if (!out[sid]) out[sid] = [];
    out[sid].push(r);
  }
  return out;
}
