/**
 * Livro local «eu devo» (cliente) — Minhas dívidas.
 * Separado de `clients[]`, do `loanManagerData` e do registry de conversão do fornecedor.
 * Sem Firebase, sem `payment.linkContext`, sem importar `calculations.js`.
 */

import { generateId } from './ids';

/** @typedef {'manual' | 'fromApprovedRequest'} ClientDebtOrigin */
/** @typedef {'active' | 'settledLocally' | 'archived'} ClientDebtStatus */
/** @typedef {'manual'} ClientDebtPaymentSource */

/**
 * @typedef {Object} ClientDebtPayment
 * @property {string} id
 * @property {string} date
 * @property {number} amount
 * @property {string} note
 * @property {string} source
 */

/**
 * @typedef {Object} ClientDebtDebt
 * @property {string} id
 * @property {string} createdAt
 * @property {ClientDebtOrigin} origin
 * @property {string} [loanRequestId]
 * @property {number} principalAmount
 * @property {number} interestRate
 * @property {string} startDate
 * @property {number} [dueDay]
 * @property {string} [dueDate]
 * @property {ClientDebtStatus} status
 * @property {string} localNote
 * @property {ClientDebtPayment[]} payments
 */

/**
 * @typedef {Object} ClientDebtSupplier
 * @property {string} id
 * @property {string} supplierId
 * @property {string} linkId
 * @property {string} [displayNameSnapshot]
 * @property {string} [notes]
 * @property {string} [archivedAt]
 * @property {ClientDebtDebt[]} debts
 */

/**
 * @typedef {Object} ClientDebtLedger
 * @property {number} schemaVersion
 * @property {ClientDebtSupplier[]} suppliers
 */

/**
 * @typedef {Object} ClientDebtDerivedSnapshot
 * @property {number} currentPrincipal
 * @property {number} estimatedMonthlyInterest
 * @property {number} estimatedSettlement
 * @property {number} totalInterestPaid
 * @property {number} totalAmortized
 */

export const CLIENT_DEBT_LEDGER_SCHEMA_VERSION = 1;

/** Status de vínculo aprovado na plataforma (string estável; evita importar `firebase/links`). */
export const CLIENT_DEBT_LINK_APPROVED_STATUS = 'approved';

export const DEBT_ORIGIN = Object.freeze({
  MANUAL: 'manual',
  FROM_APPROVED_REQUEST: 'fromApprovedRequest',
});

export const DEBT_STATUS = Object.freeze({
  ACTIVE: 'active',
  SETTLED_LOCALLY: 'settledLocally',
  ARCHIVED: 'archived',
});

export const PAYMENT_SOURCE = Object.freeze({
  MANUAL: 'manual',
});

/** Status remoto de pedido aprovado (string estável; evita importar `firebase/loanRequests`). */
export const LOAN_REQUEST_APPROVED_STATUS = 'approved';

/**
 * @returns {ClientDebtLedger}
 */
export function emptyClientDebtLedger() {
  return { schemaVersion: CLIENT_DEBT_LEDGER_SCHEMA_VERSION, suppliers: [] };
}

/**
 * @param {unknown} n
 * @param {number} [fallback]
 */
export function sanitizeNonNegativeNumber(n, fallback = 0) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return n;
}

/**
 * Taxa % ao mês; inválido → 10 (alinhado ao motor atual).
 * @param {unknown} rate
 */
export function sanitizeInterestRatePercent(rate) {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0) {
    return 10;
  }
  if (rate > 100) {
    return 100;
  }
  return rate;
}

/**
 * @param {string | undefined} s
 */
export function normalizeIsoDateString(s) {
  if (typeof s !== 'string') return '';
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return '';
  return t;
}

/**
 * @param {string} dateStr
 * @returns {{ year: number, month0: number } | null}
 */
export function parseYearMonthDay(dateStr) {
  const t = normalizeIsoDateString(dateStr);
  if (!t) return null;
  const [ys, ms] = t.split('-');
  const year = Number(ys);
  const month0 = Number(ms) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month0) || month0 < 0 || month0 > 11) {
    return null;
  }
  return { year, month0 };
}

/**
 * @param {unknown} p
 * @returns {ClientDebtPayment | null}
 */
export function normalizePayment(p) {
  if (!p || typeof p !== 'object') return null;
  const id = typeof p.id === 'string' && p.id.trim() ? p.id.trim() : generateId();
  const date = normalizeIsoDateString(/** @type {any} */ (p).date);
  if (!date) return null;
  const amount = sanitizeNonNegativeNumber(/** @type {any} */ (p).amount, 0);
  const note =
    typeof p.note === 'string' && p.note.trim().length > 0 ? p.note.trim().slice(0, 2000) : '';
  const source =
    /** @type {any} */ (p).source === PAYMENT_SOURCE.MANUAL ? PAYMENT_SOURCE.MANUAL : PAYMENT_SOURCE.MANUAL;
  return { id, date, amount, note, source };
}

/**
 * Aplica sequência de pagamentos: juros sobre saldo atual primeiro, depois amortiza principal.
 * (Espelho conceitual de `calculations.js` por lançamento, sem importar o módulo.)
 *
 * @param {number} initialPrincipal
 * @param {number} rateDecimal ex.: 0.10 para 10%
 * @param {ClientDebtPayment[]} paymentsSorted
 * @returns {{ currentPrincipal: number; totalInterestPaid: number; totalAmortized: number }}
 */
export function applyPaymentsToPrincipal(initialPrincipal, rateDecimal, paymentsSorted) {
  let principal = sanitizeNonNegativeNumber(initialPrincipal, 0);
  let totalInterestPaid = 0;
  let totalAmortized = 0;
  for (const pay of paymentsSorted) {
    const interestDue = principal * rateDecimal;
    let interestPaid = 0;
    let amortized = 0;
    if (pay.amount >= interestDue) {
      interestPaid = interestDue;
      amortized = pay.amount - interestDue;
    } else {
      interestPaid = pay.amount;
      amortized = 0;
    }
    principal -= amortized;
    if (principal < 0) principal = 0;
    totalInterestPaid += interestPaid;
    totalAmortized += amortized;
  }
  return { currentPrincipal: principal, totalInterestPaid, totalAmortized };
}

/**
 * Juros «do mês corrente» no sentido do motor: contratos iniciados no mês de referência
 * não geram expectativa neste mês (0). Caso contrário, juros sobre saldo residual.
 *
 * @param {ClientDebtDebt} debt
 * @param {number} currentPrincipal
 * @param {Date} referenceDate
 */
export function estimateMonthlyInterestForDebt(debt, currentPrincipal, referenceDate) {
  const principal = sanitizeNonNegativeNumber(currentPrincipal, 0);
  if (principal <= 0) return 0;
  const rate = sanitizeInterestRatePercent(debt.interestRate) / 100;
  const start = parseYearMonthDay(debt.startDate);
  if (!start) return 0;
  const refY = referenceDate.getFullYear();
  const refM0 = referenceDate.getMonth();
  if (start.year === refY && start.month0 === refM0) {
    return 0;
  }
  return principal * rate;
}

/**
 * Quitação estimada: saldo principal + um período de juros sobre o saldo (modelo simples).
 *
 * @param {ClientDebtDebt} debt
 * @param {number} currentPrincipal
 * @param {Date} referenceDate
 */
export function estimateSettlementForDebt(debt, currentPrincipal, referenceDate) {
  const principal = sanitizeNonNegativeNumber(currentPrincipal, 0);
  if (principal <= 0) return 0;
  const interest = estimateMonthlyInterestForDebt(debt, principal, referenceDate);
  return principal + interest;
}

/**
 * @param {unknown} d
 * @returns {ClientDebtDebt | null}
 */
export function normalizeDebt(d) {
  if (!d || typeof d !== 'object') return null;
  const id = typeof d.id === 'string' && d.id.trim() ? d.id.trim() : generateId();
  const createdAt =
    typeof d.createdAt === 'string' && d.createdAt.trim()
      ? d.createdAt.trim().slice(0, 40)
      : new Date().toISOString().slice(0, 19);
  const origin =
    d.origin === DEBT_ORIGIN.FROM_APPROVED_REQUEST
      ? DEBT_ORIGIN.FROM_APPROVED_REQUEST
      : DEBT_ORIGIN.MANUAL;
  const loanRequestId =
    typeof d.loanRequestId === 'string' && d.loanRequestId.trim() ? d.loanRequestId.trim() : '';
  const principalAmount = sanitizeNonNegativeNumber(d.principalAmount, 0);
  const interestRate = sanitizeInterestRatePercent(d.interestRate);
  const startDate = normalizeIsoDateString(d.startDate) || new Date().toISOString().slice(0, 10);
  let status = /** @type {ClientDebtStatus} */ (d.status);
  if (status !== DEBT_STATUS.ACTIVE && status !== DEBT_STATUS.SETTLED_LOCALLY && status !== DEBT_STATUS.ARCHIVED) {
    status = DEBT_STATUS.ACTIVE;
  }
  const localNote =
    typeof d.localNote === 'string' && d.localNote.trim().length > 0
      ? d.localNote.trim().slice(0, 4000)
      : '';
  let dueDay =
    typeof d.dueDay === 'number' && Number.isFinite(d.dueDay) && d.dueDay >= 1 && d.dueDay <= 31
      ? Math.floor(d.dueDay)
      : null;
  if (dueDay === null && d.dueDay != null) {
    dueDay = null;
  }
  const dueDate = normalizeIsoDateString(d.dueDate) || '';

  const rawPayments = Array.isArray(d.payments) ? d.payments : [];
  const payments = rawPayments
    .map((p) => normalizePayment(p))
    .filter(Boolean)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const rateDec = interestRate / 100;
  const { currentPrincipal } = applyPaymentsToPrincipal(principalAmount, rateDec, payments);

  let nextStatus = status;
  if (currentPrincipal <= 0 && status === DEBT_STATUS.ACTIVE) {
    nextStatus = DEBT_STATUS.SETTLED_LOCALLY;
  }

  /** @type {ClientDebtDebt} */
  const out = {
    id,
    createdAt,
    origin,
    principalAmount,
    interestRate,
    startDate,
    status: nextStatus,
    localNote,
    payments,
  };
  if (loanRequestId) {
    out.loanRequestId = loanRequestId;
  }
  if (dueDay != null) {
    out.dueDay = dueDay;
  }
  if (dueDate) {
    out.dueDate = dueDate;
  }
  return out;
}

/**
 * @param {unknown} s
 * @returns {ClientDebtSupplier | null}
 */
export function normalizeSupplier(s) {
  if (!s || typeof s !== 'object') return null;
  const supplierId =
    typeof s.supplierId === 'string' && s.supplierId.trim() ? s.supplierId.trim() : '';
  const linkId = typeof s.linkId === 'string' && s.linkId.trim() ? s.linkId.trim() : '';
  if (!supplierId || !linkId) return null;

  let id =
    typeof s.id === 'string' && s.id.trim()
      ? s.id.trim()
      : `cdls_${linkId}_${supplierId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);

  const displayNameSnapshot =
    typeof s.displayNameSnapshot === 'string' && s.displayNameSnapshot.trim()
      ? s.displayNameSnapshot.trim().slice(0, 200)
      : '';
  const notes =
    typeof s.notes === 'string' && s.notes.trim().length > 0 ? s.notes.trim().slice(0, 4000) : '';
  const archivedAt =
    typeof s.archivedAt === 'string' && s.archivedAt.trim() ? s.archivedAt.trim().slice(0, 40) : '';

  const rawDebts = Array.isArray(s.debts) ? s.debts : [];
  const debts = rawDebts.map((d) => normalizeDebt(d)).filter(Boolean);

  /** @type {ClientDebtSupplier} */
  const out = {
    id,
    supplierId,
    linkId,
    debts,
  };
  if (displayNameSnapshot) out.displayNameSnapshot = displayNameSnapshot;
  if (notes) out.notes = notes;
  if (archivedAt) out.archivedAt = archivedAt;
  return out;
}

/**
 * @param {unknown} raw
 */
export function normalizeClientDebtLedger(raw) {
  const base = emptyClientDebtLedger();
  if (!raw || typeof raw !== 'object') {
    return base;
  }
  const sv = /** @type {any} */ (raw).schemaVersion;
  base.schemaVersion =
    typeof sv === 'number' && Number.isFinite(sv) && sv > 0
      ? Math.floor(sv)
      : CLIENT_DEBT_LEDGER_SCHEMA_VERSION;

  const list = Array.isArray(/** @type {any} */ (raw).suppliers) ? /** @type {any} */ (raw).suppliers : [];
  base.suppliers = list.map((s) => normalizeSupplier(s)).filter(Boolean);
  return base;
}

/**
 * @param {object} link — objeto mínimo: id, supplierId, clientId, status
 * @param {{ displayNameSnapshot?: string }} [options]
 * @returns {ClientDebtSupplier | null}
 */
export function createSupplierFromApprovedLink(link, options = {}) {
  if (!link || typeof link !== 'object') return null;
  const supplierId = typeof link.supplierId === 'string' ? link.supplierId.trim() : '';
  const linkId = typeof link.id === 'string' ? link.id.trim() : '';
  const status = typeof link.status === 'string' ? link.status.trim() : '';
  if (!supplierId || !linkId || status !== CLIENT_DEBT_LINK_APPROVED_STATUS) {
    return null;
  }
  /** @type {ClientDebtSupplier} */
  const s = {
    id: generateId(),
    supplierId,
    linkId,
    debts: [],
  };
  const snap =
    (options.displayNameSnapshot && String(options.displayNameSnapshot).trim()) ||
    (typeof link.supplierDisplayNameSnapshot === 'string' && link.supplierDisplayNameSnapshot.trim()
      ? link.supplierDisplayNameSnapshot.trim()
      : '');
  if (snap) s.displayNameSnapshot = snap.slice(0, 200);
  return normalizeSupplier(s);
}

/**
 * @param {object} input
 * @returns {ClientDebtDebt}
 */
export function createManualDebtDraft(input) {
  const principalAmount = sanitizeNonNegativeNumber(input?.principalAmount, 0);
  const interestRate = sanitizeInterestRatePercent(input?.interestRate);
  const startDate =
    normalizeIsoDateString(input?.startDate) || new Date().toISOString().slice(0, 10);
  const localNote =
    typeof input?.localNote === 'string' && input.localNote.trim()
      ? input.localNote.trim().slice(0, 4000)
      : '';
  /** @type {ClientDebtDebt} */
  const draft = {
    id: typeof input?.id === 'string' && input.id.trim() ? input.id.trim() : generateId(),
    createdAt:
      typeof input?.createdAt === 'string' && input.createdAt.trim()
        ? input.createdAt.trim()
        : new Date().toISOString().slice(0, 19),
    origin: DEBT_ORIGIN.MANUAL,
    principalAmount,
    interestRate,
    startDate,
    status: DEBT_STATUS.ACTIVE,
    localNote,
    payments: [],
  };
  if (typeof input?.dueDay === 'number' && Number.isFinite(input.dueDay)) {
    draft.dueDay = Math.floor(input.dueDay);
  }
  const dd = normalizeIsoDateString(input?.dueDate);
  if (dd) draft.dueDate = dd;
  return normalizeDebt(draft);
}

/**
 * Apenas rascunho / pré-preenchimento a partir de um pedido remoto aprovado.
 * Não grava no ledger nem persiste — a camada chamadora confirma antes de anexar.
 *
 * @param {object} loanRequest — mínimo: id, status, approvedAmount (centavos), supplierId, linkId opcional
 * @param {object} link — vínculo aprovado (para linkId / snapshot)
 * @param {{ interestRate?: number; startDate?: string }} [options]
 * @returns {ClientDebtDebt | null}
 */
export function createDebtDraftFromApprovedLoanRequest(loanRequest, link, options = {}) {
  if (!loanRequest || typeof loanRequest !== 'object') return null;
  const status = typeof loanRequest.status === 'string' ? loanRequest.status.trim() : '';
  if (status !== LOAN_REQUEST_APPROVED_STATUS) return null;

  const approvedCents = loanRequest.approvedAmount ?? loanRequest.requestedAmount;
  const cents =
    typeof approvedCents === 'number' && Number.isFinite(approvedCents)
      ? Math.max(0, Math.round(approvedCents))
      : 0;
  const principalReais = cents / 100;

  const lrId = typeof loanRequest.id === 'string' ? loanRequest.id.trim() : '';
  if (!lrId) return null;

  const linkId =
    (link && typeof link.id === 'string' && link.id.trim()) ||
    (typeof loanRequest.linkId === 'string' && loanRequest.linkId.trim()) ||
    '';

  const startDate =
    normalizeIsoDateString(options.startDate) || new Date().toISOString().slice(0, 10);

  /** @type {ClientDebtDebt} */
  const draft = {
    id: generateId(),
    createdAt: new Date().toISOString().slice(0, 19),
    origin: DEBT_ORIGIN.FROM_APPROVED_REQUEST,
    loanRequestId: lrId,
    principalAmount: sanitizeNonNegativeNumber(principalReais, 0),
    interestRate: sanitizeInterestRatePercent(options.interestRate ?? 10),
    startDate,
    status: DEBT_STATUS.ACTIVE,
    localNote: '',
    payments: [],
  };
  return normalizeDebt(draft);
}

/**
 * Validação mínima para criação explícita (camada chamadora pode exigir antes de persistir).
 *
 * @param {ClientDebtDebt} debt
 */
export function validateMinimumDebtForCommit(debt) {
  if (!debt || typeof debt !== 'object') {
    return { ok: false, message: 'Dívida inválida.' };
  }
  if (sanitizeNonNegativeNumber(debt.principalAmount, -1) <= 0) {
    return { ok: false, message: 'Informe um valor principal maior que zero.' };
  }
  const sd = normalizeIsoDateString(debt.startDate);
  if (!sd) {
    return { ok: false, message: 'Data inicial inválida.' };
  }
  return { ok: true, message: '' };
}

/**
 * @param {ClientDebtDebt} debt
 * @param {Date} [referenceDate]
 * @returns {ClientDebtDerivedSnapshot}
 */
export function deriveDebtSnapshot(debt, referenceDate = new Date()) {
  const normalized = normalizeDebt(debt);
  if (!normalized) {
    return {
      currentPrincipal: 0,
      estimatedMonthlyInterest: 0,
      estimatedSettlement: 0,
      totalInterestPaid: 0,
      totalAmortized: 0,
    };
  }
  const rateDec = sanitizeInterestRatePercent(normalized.interestRate) / 100;
  const sorted = [...normalized.payments].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const applied = applyPaymentsToPrincipal(normalized.principalAmount, rateDec, sorted);
  const estInt = estimateMonthlyInterestForDebt(normalized, applied.currentPrincipal, referenceDate);
  const estSettle = estimateSettlementForDebt(normalized, applied.currentPrincipal, referenceDate);
  return {
    currentPrincipal: applied.currentPrincipal,
    estimatedMonthlyInterest: estInt,
    estimatedSettlement: estSettle,
    totalInterestPaid: applied.totalInterestPaid,
    totalAmortized: applied.totalAmortized,
  };
}

/**
 * @param {ClientDebtSupplier} supplier
 * @param {Date} [referenceDate]
 */
export function deriveSupplierTotals(supplier, referenceDate = new Date()) {
  const s = normalizeSupplier(supplier);
  if (!s) {
    return {
      openPrincipal: 0,
      estimatedMonthlyInterest: 0,
      estimatedSettlement: 0,
      activeDebts: 0,
    };
  }
  let openPrincipal = 0;
  let estimatedMonthlyInterest = 0;
  let estimatedSettlement = 0;
  let activeDebts = 0;
  for (const d of s.debts) {
    if (d.status === DEBT_STATUS.ARCHIVED) continue;
    const snap = deriveDebtSnapshot(d, referenceDate);
    if (d.status === DEBT_STATUS.ACTIVE || d.status === DEBT_STATUS.SETTLED_LOCALLY) {
      openPrincipal += snap.currentPrincipal;
      estimatedMonthlyInterest += snap.estimatedMonthlyInterest;
      estimatedSettlement += snap.estimatedSettlement;
    }
    if (d.status === DEBT_STATUS.ACTIVE && snap.currentPrincipal > 0) {
      activeDebts += 1;
    }
  }
  return { openPrincipal, estimatedMonthlyInterest, estimatedSettlement, activeDebts };
}

/**
 * @param {ClientDebtLedger} ledger
 * @param {Date} [referenceDate]
 */
export function deriveLedgerTotals(ledger, referenceDate = new Date()) {
  const L = normalizeClientDebtLedger(ledger);
  let openPrincipal = 0;
  let estimatedMonthlyInterest = 0;
  let estimatedSettlement = 0;
  let suppliersWithOpenDebt = 0;
  for (const s of L.suppliers) {
    const t = deriveSupplierTotals(s, referenceDate);
    openPrincipal += t.openPrincipal;
    estimatedMonthlyInterest += t.estimatedMonthlyInterest;
    estimatedSettlement += t.estimatedSettlement;
    if (t.activeDebts > 0) suppliersWithOpenDebt += 1;
  }
  return {
    openPrincipal,
    estimatedMonthlyInterest,
    estimatedSettlement,
    suppliersWithOpenDebt,
  };
}

/**
 * @param {ClientDebtLedger} ledger
 * @param {string} supplierId
 * @param {ClientDebtDebt} debtDraft
 */
export function appendDebtToSupplierLedger(ledger, supplierId, debtDraft) {
  const L = normalizeClientDebtLedger(ledger);
  const sid = typeof supplierId === 'string' ? supplierId.trim() : '';
  const debt = normalizeDebt(debtDraft);
  if (!sid || !debt) return L;

  const idx = L.suppliers.findIndex((s) => s.supplierId === sid);
  if (idx < 0) return L;

  const nextSuppliers = L.suppliers.map((s, i) => {
    if (i !== idx) return s;
    return normalizeSupplier({ ...s, debts: [...s.debts, debt] });
  });
  return normalizeClientDebtLedger({ ...L, suppliers: nextSuppliers });
}

/**
 * Anexa fornecedor ao ledger se ainda não existir o par `supplierId`+`linkId`.
 *
 * @param {ClientDebtLedger} ledger
 * @param {ClientDebtSupplier} supplier
 * @returns {ClientDebtLedger}
 */
export function appendSupplierToLedgerIfMissing(ledger, supplier) {
  const L = normalizeClientDebtLedger(ledger);
  const s = normalizeSupplier(supplier);
  if (!s) return L;
  const exists = L.suppliers.some((x) => x.supplierId === s.supplierId && x.linkId === s.linkId);
  if (exists) return L;
  return normalizeClientDebtLedger({ ...L, suppliers: [...L.suppliers, s] });
}
