import { describe, it, expect, beforeEach } from 'vitest';

import {
  appendDebtToSupplierLedger,
  appendPaymentToDebt,
  appendSupplierToLedgerIfMissing,
  applyPaymentsToPrincipal,
  calendarDaysBetweenIso,
  CLIENT_DEBT_LINK_APPROVED_STATUS,
  createDebtDraftFromApprovedLoanRequest,
  createManualDebtDraft,
  createSupplierFromApprovedLink,
  DEBT_DUE_REMINDER_KIND,
  DEBT_ORIGIN,
  DEBT_STATUS,
  deriveDebtDueEffectiveIso,
  deriveDebtDueReminder,
  deriveDebtSnapshot,
  deriveLedgerTotals,
  deriveSupplierDueSummary,
  deriveSupplierTotals,
  emptyClientDebtLedger,
  estimateMonthlyInterestForDebt,
  estimateSettlementForDebt,
  LOAN_REQUEST_APPROVED_STATUS,
  normalizeClientDebtLedger,
  normalizePayment,
  sanitizeInterestRatePercent,
  validateMinimumDebtForCommit,
  findSupplierEntry,
  updateDebtStatusInLedger,
} from '../clientDebtLedger';
import { loadClientDebtLedger, saveClientDebtLedger } from '../storage';
import { getScopedClientDebtLedgerKey } from '../storageScope';

describe('clientDebtLedger', () => {
  it('ledger ausente / null normaliza para estrutura vazia válida', () => {
    expect(normalizeClientDebtLedger(null)).toEqual(emptyClientDebtLedger());
    expect(normalizeClientDebtLedger(undefined)).toEqual(emptyClientDebtLedger());
    expect(normalizeClientDebtLedger({ suppliers: null })).toEqual(emptyClientDebtLedger());
    expect(normalizeClientDebtLedger({ suppliers: 'x' })).toEqual(emptyClientDebtLedger());
  });

  it('descarta suppliers inválidos (sem supplierId ou linkId)', () => {
    const L = normalizeClientDebtLedger({
      suppliers: [
        { supplierId: 's1', linkId: 'l1', debts: [] },
        { supplierId: '', linkId: 'l2', debts: [] },
        { supplierId: 's3', linkId: '', debts: [] },
        { foo: 1 },
      ],
    });
    expect(L.suppliers).toHaveLength(1);
    expect(L.suppliers[0].supplierId).toBe('s1');
  });

  it('normaliza debts com principal negativo/NaN para zero e ajusta status quitado', () => {
    const L = normalizeClientDebtLedger({
      suppliers: [
        {
          supplierId: 's',
          linkId: 'l',
          debts: [
            {
              id: 'd1',
              createdAt: 'x',
              origin: DEBT_ORIGIN.MANUAL,
              principalAmount: -100,
              interestRate: NaN,
              startDate: '2025-02-01',
              status: DEBT_STATUS.ACTIVE,
              localNote: '',
              payments: [],
            },
          ],
        },
      ],
    });
    const d = L.suppliers[0].debts[0];
    expect(d.principalAmount).toBe(0);
    expect(d.interestRate).toBe(10);
    expect(d.status).toBe(DEBT_STATUS.SETTLED_LOCALLY);
  });

  it('findSupplierEntry retorna entrada ou null', () => {
    const L = normalizeClientDebtLedger({
      suppliers: [{ supplierId: 'a', linkId: 'b', debts: [] }],
    });
    expect(findSupplierEntry(L, '', 'b')).toBe(null);
    expect(findSupplierEntry(L, 'a', '')).toBe(null);
    expect(findSupplierEntry(L, 'a', 'x')).toBe(null);
    expect(findSupplierEntry(L, 'a', 'b')?.supplierId).toBe('a');
  });

  it('normaliza payments inválidos (remove data inválida)', () => {
    const L = normalizeClientDebtLedger({
      suppliers: [
        {
          supplierId: 's',
          linkId: 'l',
          debts: [
            {
              id: 'd1',
              createdAt: '2025-01-01T00:00:00',
              origin: DEBT_ORIGIN.MANUAL,
              principalAmount: 1000,
              interestRate: 10,
              startDate: '2025-01-01',
              status: DEBT_STATUS.ACTIVE,
              localNote: '',
              payments: [
                { id: 'p1', date: 'bad-date', amount: 10, note: '', source: 'manual' },
                { id: 'p2', date: '2025-02-01', amount: -5, note: '', source: 'manual' },
                { id: 'p3', date: '2025-02-15', amount: 100, note: 'ok', source: 'manual' },
              ],
            },
          ],
        },
      ],
    });
    expect(L.suppliers[0].debts[0].payments).toHaveLength(2);
    expect(L.suppliers[0].debts[0].payments.map((p) => p.amount)).toEqual([0, 100]);
  });

  it('createSupplierFromApprovedLink só aceita vínculo aprovado', () => {
    expect(
      createSupplierFromApprovedLink({
        id: 'L1',
        supplierId: 'S1',
        clientId: 'C1',
        status: CLIENT_DEBT_LINK_APPROVED_STATUS,
      }),
    ).toMatchObject({ supplierId: 'S1', linkId: 'L1', debts: [] });
    expect(
      createSupplierFromApprovedLink({
        id: 'L1',
        supplierId: 'S1',
        status: 'pending',
      }),
    ).toBeNull();
  });

  it('createManualDebtDraft + validateMinimumDebtForCommit', () => {
    const d = createManualDebtDraft({
      principalAmount: 500,
      interestRate: 12,
      startDate: '2025-06-01',
      localNote: 'x',
    });
    expect(d.origin).toBe(DEBT_ORIGIN.MANUAL);
    expect(validateMinimumDebtForCommit(d).ok).toBe(true);
    expect(validateMinimumDebtForCommit({ ...d, principalAmount: 0 }).ok).toBe(false);
  });

  it('draft a partir de loanRequest approved não persiste e não altera ledger vazio', () => {
    const draft = createDebtDraftFromApprovedLoanRequest(
      {
        id: 'lr1',
        status: LOAN_REQUEST_APPROVED_STATUS,
        approvedAmount: 15050,
        linkId: 'L9',
      },
      { id: 'L9', supplierId: 'S9', status: CLIENT_DEBT_LINK_APPROVED_STATUS },
      { startDate: '2025-03-01', interestRate: 10 },
    );
    expect(draft).not.toBeNull();
    expect(draft?.principalAmount).toBeCloseTo(150.5, 5);
    expect(draft?.loanRequestId).toBe('lr1');
    expect(draft?.origin).toBe(DEBT_ORIGIN.FROM_APPROVED_REQUEST);

    expect(createDebtDraftFromApprovedLoanRequest({ id: 'x', status: 'pending', approvedAmount: 100 }, null)).toBeNull();

    const L = emptyClientDebtLedger();
    expect(L.suppliers).toHaveLength(0);
  });

  it('pagamento parcial abate juros antes do principal', () => {
    const debt = createManualDebtDraft({
      principalAmount: 1000,
      interestRate: 10,
      startDate: '2025-01-01',
      id: 'd1',
    });
    const withPay = normalizeClientDebtLedger({
      suppliers: [
        {
          supplierId: 's',
          linkId: 'l',
          debts: [
            {
              ...debt,
              payments: [{ id: 'p1', date: '2025-02-01', amount: 50, note: '', source: 'manual' }],
            },
          ],
        },
      ],
    }).suppliers[0].debts[0];

    const rate = 0.1;
    const { currentPrincipal } = applyPaymentsToPrincipal(1000, rate, withPay.payments);
    expect(currentPrincipal).toBe(1000);
    const snap = deriveDebtSnapshot(withPay, new Date('2025-03-15'));
    expect(snap.totalInterestPaid).toBe(50);
    expect(snap.totalAmortized).toBe(0);
  });

  it('pagamento maior que quitação zera principal (excesso ignorado como no motor)', () => {
    const debt = normalizeClientDebtLedger({
      suppliers: [
        {
          supplierId: 's',
          linkId: 'l',
          debts: [
            {
              id: 'd1',
              createdAt: '2025-01-01',
              origin: DEBT_ORIGIN.MANUAL,
              principalAmount: 1000,
              interestRate: 10,
              startDate: '2025-01-01',
              status: DEBT_STATUS.ACTIVE,
              localNote: '',
              payments: [{ id: 'p1', date: '2025-02-01', amount: 10000, note: '', source: 'manual' }],
            },
          ],
        },
      ],
    }).suppliers[0].debts[0];

    const snap = deriveDebtSnapshot(debt, new Date('2025-03-15'));
    expect(snap.currentPrincipal).toBe(0);
    expect(debt.status).toBe(DEBT_STATUS.SETTLED_LOCALLY);
  });

  it('dívida quitada fica settledLocally após normalização', () => {
    const L = normalizeClientDebtLedger({
      suppliers: [
        {
          supplierId: 's',
          linkId: 'l',
          debts: [
            {
              id: 'd1',
              createdAt: '2025-01-01',
              origin: DEBT_ORIGIN.MANUAL,
              principalAmount: 100,
              interestRate: 10,
              startDate: '2025-01-01',
              status: DEBT_STATUS.ACTIVE,
              localNote: '',
              payments: [{ id: 'p1', date: '2025-02-01', amount: 200, note: '', source: 'manual' }],
            },
          ],
        },
      ],
    });
    expect(L.suppliers[0].debts[0].status).toBe(DEBT_STATUS.SETTLED_LOCALLY);
  });

  it('fornecedor com múltiplas dívidas e totais do ledger', () => {
    const ref = new Date('2025-04-10');
    const L = normalizeClientDebtLedger({
      suppliers: [
        {
          supplierId: 'S1',
          linkId: 'L1',
          debts: [
            {
              id: 'd1',
              createdAt: '2025-01-01',
              origin: DEBT_ORIGIN.MANUAL,
              principalAmount: 1000,
              interestRate: 10,
              startDate: '2025-01-01',
              status: DEBT_STATUS.ACTIVE,
              localNote: '',
              payments: [],
            },
            {
              id: 'd2',
              createdAt: '2025-01-01',
              origin: DEBT_ORIGIN.MANUAL,
              principalAmount: 500,
              interestRate: 10,
              startDate: '2025-02-01',
              status: DEBT_STATUS.ACTIVE,
              localNote: '',
              payments: [],
            },
          ],
        },
      ],
    });
    const st = deriveSupplierTotals(L.suppliers[0], ref);
    expect(st.openPrincipal).toBe(1500);
    expect(st.estimatedMonthlyInterest).toBeCloseTo(100 + 50, 5);
    expect(st.estimatedSettlement).toBeCloseTo(1100 + 550, 5);
    const lt = deriveLedgerTotals(L, ref);
    expect(lt.openPrincipal).toBe(1500);
    expect(lt.suppliersWithOpenDebt).toBe(1);
  });

  it('juros do mês corrente zero quando contrato nasce no mesmo mês (referência)', () => {
    const debt = createManualDebtDraft({
      principalAmount: 1000,
      interestRate: 10,
      startDate: '2025-04-05',
    });
    const ref = new Date('2025-04-20');
    const snap = deriveDebtSnapshot(debt, ref);
    expect(estimateMonthlyInterestForDebt(debt, snap.currentPrincipal, ref)).toBe(0);
    expect(estimateSettlementForDebt(debt, snap.currentPrincipal, ref)).toBe(1000);
  });

  it('appendSupplierToLedgerIfMissing e appendDebtToSupplierLedger', () => {
    const sup = createSupplierFromApprovedLink({
      id: 'L1',
      supplierId: 'S1',
      status: CLIENT_DEBT_LINK_APPROVED_STATUS,
    });
    let L = emptyClientDebtLedger();
    L = appendSupplierToLedgerIfMissing(L, sup);
    L = appendSupplierToLedgerIfMissing(L, sup);
    expect(L.suppliers).toHaveLength(1);

    const debt = createManualDebtDraft({
      principalAmount: 200,
      interestRate: 10,
      startDate: '2025-01-01',
    });
    L = appendDebtToSupplierLedger(L, 'S1', 'L1', debt);
    expect(L.suppliers[0].debts).toHaveLength(1);
    expect(appendDebtToSupplierLedger(L, 'missing', 'L1', debt).suppliers[0].debts).toHaveLength(1);
  });

  it('appendDebtToSupplierLedger grava no vínculo correto quando mesmo supplierId tem dois links', () => {
    let L = emptyClientDebtLedger();
    L = appendSupplierToLedgerIfMissing(
      L,
      createSupplierFromApprovedLink({
        id: 'L1',
        supplierId: 'S1',
        status: CLIENT_DEBT_LINK_APPROVED_STATUS,
      }),
    );
    L = appendSupplierToLedgerIfMissing(
      L,
      createSupplierFromApprovedLink({
        id: 'L2',
        supplierId: 'S1',
        status: CLIENT_DEBT_LINK_APPROVED_STATUS,
      }),
    );
    const debt = createManualDebtDraft({
      principalAmount: 100,
      interestRate: 10,
      startDate: '2025-01-01',
    });
    L = appendDebtToSupplierLedger(L, 'S1', 'L2', debt);
    expect(L.suppliers.find((x) => x.linkId === 'L1')?.debts ?? []).toHaveLength(0);
    expect(L.suppliers.find((x) => x.linkId === 'L2')?.debts ?? []).toHaveLength(1);
  });

  it('appendPaymentToDebt aplica pagamento e atualiza principal derivado', () => {
    const sup = createSupplierFromApprovedLink({
      id: 'L1',
      supplierId: 'S1',
      status: CLIENT_DEBT_LINK_APPROVED_STATUS,
    });
    let L = appendSupplierToLedgerIfMissing(emptyClientDebtLedger(), sup);
    const debt = createManualDebtDraft({
      principalAmount: 1000,
      interestRate: 10,
      startDate: '2025-01-01',
    });
    L = appendDebtToSupplierLedger(L, 'S1', 'L1', debt);
    const debtId = L.suppliers[0].debts[0].id;
    const ref = new Date('2025-02-15');
    L = appendPaymentToDebt(L, 'S1', 'L1', debtId, {
      id: 'p1',
      date: '2025-02-10',
      amount: 200,
      note: '',
      source: 'manual',
    });
    const d = L.suppliers[0].debts[0];
    const snap = deriveDebtSnapshot(d, ref);
    expect(snap.currentPrincipal).toBeLessThan(1000);
    expect(snap.totalInterestPaid).toBeGreaterThan(0);
  });

  it('appendPaymentToDebt ignora dívida arquivada', () => {
    const sup = createSupplierFromApprovedLink({
      id: 'L1',
      supplierId: 'S1',
      status: CLIENT_DEBT_LINK_APPROVED_STATUS,
    });
    let L = appendSupplierToLedgerIfMissing(emptyClientDebtLedger(), sup);
    const debt = createManualDebtDraft({
      principalAmount: 100,
      interestRate: 10,
      startDate: '2025-01-01',
    });
    L = appendDebtToSupplierLedger(L, 'S1', 'L1', debt);
    const debtId = L.suppliers[0].debts[0].id;
    L = updateDebtStatusInLedger(L, 'S1', 'L1', debtId, DEBT_STATUS.ARCHIVED);
    const beforeLen = L.suppliers[0].debts[0].payments.length;
    L = appendPaymentToDebt(L, 'S1', 'L1', debtId, {
      id: 'p1',
      date: '2025-02-10',
      amount: 10,
      note: '',
      source: 'manual',
    });
    expect(L.suppliers[0].debts[0].payments.length).toBe(beforeLen);
  });

  it('updateDebtStatusInLedger altera status', () => {
    const sup = createSupplierFromApprovedLink({
      id: 'L1',
      supplierId: 'S1',
      status: CLIENT_DEBT_LINK_APPROVED_STATUS,
    });
    let L = appendSupplierToLedgerIfMissing(emptyClientDebtLedger(), sup);
    const debt = createManualDebtDraft({
      principalAmount: 100,
      interestRate: 10,
      startDate: '2025-01-01',
    });
    L = appendDebtToSupplierLedger(L, 'S1', 'L1', debt);
    const debtId = L.suppliers[0].debts[0].id;
    L = updateDebtStatusInLedger(L, 'S1', 'L1', debtId, DEBT_STATUS.ARCHIVED);
    expect(L.suppliers[0].debts[0].status).toBe(DEBT_STATUS.ARCHIVED);
  });

  it('dueDate tem prioridade sobre dueDay em deriveDebtDueEffectiveIso', () => {
    const d = normalizeClientDebtLedger({
      suppliers: [
        {
          supplierId: 's',
          linkId: 'l',
          debts: [
            {
              id: 'd1',
              createdAt: '2025-01-01',
              origin: DEBT_ORIGIN.MANUAL,
              principalAmount: 100,
              interestRate: 10,
              startDate: '2025-01-01',
              status: DEBT_STATUS.ACTIVE,
              localNote: '',
              payments: [],
              dueDate: '2025-08-10',
              dueDay: 5,
            },
          ],
        },
      ],
    }).suppliers[0].debts[0];
    expect(deriveDebtDueEffectiveIso(d, new Date(2025, 1, 15, 12, 0, 0))).toBe('2025-08-10');
  });

  it('sem dueDate nem dueDay → sem vencimento efetivo', () => {
    const d = createManualDebtDraft({
      principalAmount: 200,
      interestRate: 10,
      startDate: '2025-01-01',
    });
    expect(deriveDebtDueEffectiveIso(d, new Date(2025, 5, 1, 12, 0, 0))).toBe('');
    const r = deriveDebtDueReminder(d, new Date(2025, 5, 1, 12, 0, 0));
    expect(r.kind).toBe(DEBT_DUE_REMINDER_KIND.NO_DUE);
  });

  it('dueDay 31 em fevereiro → último dia válido (mês do referenceDate)', () => {
    const d = normalizeClientDebtLedger({
      suppliers: [
        {
          supplierId: 's',
          linkId: 'l',
          debts: [
            {
              id: 'd1',
              createdAt: '2025-01-01',
              origin: DEBT_ORIGIN.MANUAL,
              principalAmount: 100,
              interestRate: 10,
              startDate: '2025-01-01',
              status: DEBT_STATUS.ACTIVE,
              localNote: '',
              payments: [],
              dueDay: 31,
            },
          ],
        },
      ],
    }).suppliers[0].debts[0];
    expect(deriveDebtDueEffectiveIso(d, new Date(2025, 1, 10, 12, 0, 0))).toBe('2025-02-28');
    expect(deriveDebtDueEffectiveIso(d, new Date(2024, 1, 10, 12, 0, 0))).toBe('2024-02-29');
  });

  it('dueDay 30 em fevereiro comum → 29 em bissexto, 28 em não bissexto', () => {
    const base = {
      id: 'd1',
      createdAt: '2025-01-01',
      origin: DEBT_ORIGIN.MANUAL,
      principalAmount: 100,
      interestRate: 10,
      startDate: '2025-01-01',
      status: DEBT_STATUS.ACTIVE,
      localNote: '',
      payments: [],
      dueDay: 30,
    };
    const d2025 = normalizeClientDebtLedger({
      suppliers: [{ supplierId: 's', linkId: 'l', debts: [base] }],
    }).suppliers[0].debts[0];
    expect(deriveDebtDueEffectiveIso(d2025, new Date(2025, 1, 10, 12, 0, 0))).toBe('2025-02-28');
    const d2024 = normalizeClientDebtLedger({
      suppliers: [{ supplierId: 's', linkId: 'l', debts: [{ ...base, id: 'd2' }] }],
    }).suppliers[0].debts[0];
    expect(deriveDebtDueEffectiveIso(d2024, new Date(2024, 1, 10, 12, 0, 0))).toBe('2024-02-29');
  });

  it('lembretes: em dia (fora da janela de 7 dias), próximo, atrasado', () => {
    const ref = new Date(2025, 5, 15, 12, 0, 0);
    const onTrack = normalizeClientDebtLedger({
      suppliers: [
        {
          supplierId: 's',
          linkId: 'l',
          debts: [
            {
              id: 'd1',
              createdAt: '2025-01-01',
              origin: DEBT_ORIGIN.MANUAL,
              principalAmount: 100,
              interestRate: 10,
              startDate: '2025-01-01',
              status: DEBT_STATUS.ACTIVE,
              localNote: '',
              payments: [],
              dueDate: '2025-07-20',
            },
          ],
        },
      ],
    }).suppliers[0].debts[0];
    expect(deriveDebtDueReminder(onTrack, ref).kind).toBe(DEBT_DUE_REMINDER_KIND.ON_TRACK);

    const upcoming = normalizeClientDebtLedger({
      suppliers: [
        {
          supplierId: 's',
          linkId: 'l',
          debts: [
            {
              id: 'd2',
              createdAt: '2025-01-01',
              origin: DEBT_ORIGIN.MANUAL,
              principalAmount: 100,
              interestRate: 10,
              startDate: '2025-01-01',
              status: DEBT_STATUS.ACTIVE,
              localNote: '',
              payments: [],
              dueDate: '2025-06-18',
            },
          ],
        },
      ],
    }).suppliers[0].debts[0];
    expect(deriveDebtDueReminder(upcoming, ref).kind).toBe(DEBT_DUE_REMINDER_KIND.UPCOMING);
    expect(deriveDebtDueReminder(upcoming, ref).daysUntilDue).toBe(3);

    const overdue = normalizeClientDebtLedger({
      suppliers: [
        {
          supplierId: 's',
          linkId: 'l',
          debts: [
            {
              id: 'd3',
              createdAt: '2025-01-01',
              origin: DEBT_ORIGIN.MANUAL,
              principalAmount: 100,
              interestRate: 10,
              startDate: '2025-01-01',
              status: DEBT_STATUS.ACTIVE,
              localNote: '',
              payments: [],
              dueDate: '2025-06-01',
            },
          ],
        },
      ],
    }).suppliers[0].debts[0];
    expect(deriveDebtDueReminder(overdue, ref).kind).toBe(DEBT_DUE_REMINDER_KIND.OVERDUE);
  });

  it('settledLocally e archived sobrepõem lembrete de calendário', () => {
    const ref = new Date(2025, 5, 15, 12, 0, 0);
    const settled = normalizeClientDebtLedger({
      suppliers: [
        {
          supplierId: 's',
          linkId: 'l',
          debts: [
            {
              id: 'd1',
              createdAt: '2025-01-01',
              origin: DEBT_ORIGIN.MANUAL,
              principalAmount: 100,
              interestRate: 10,
              startDate: '2025-01-01',
              status: DEBT_STATUS.SETTLED_LOCALLY,
              localNote: '',
              payments: [],
              dueDate: '2025-01-01',
            },
          ],
        },
      ],
    }).suppliers[0].debts[0];
    expect(deriveDebtDueReminder(settled, ref).kind).toBe(DEBT_DUE_REMINDER_KIND.SETTLED_LOCALLY);

    const archived = normalizeClientDebtLedger({
      suppliers: [
        {
          supplierId: 's',
          linkId: 'l',
          debts: [
            {
              id: 'd2',
              createdAt: '2025-01-01',
              origin: DEBT_ORIGIN.MANUAL,
              principalAmount: 100,
              interestRate: 10,
              startDate: '2025-01-01',
              status: DEBT_STATUS.ARCHIVED,
              localNote: '',
              payments: [],
              dueDate: '2020-01-01',
            },
          ],
        },
      ],
    }).suppliers[0].debts[0];
    expect(deriveDebtDueReminder(archived, ref).kind).toBe(DEBT_DUE_REMINDER_KIND.ARCHIVED);
  });

  it('deriveSupplierDueSummary prioriza overdue sobre upcoming; ignora settled no ranking', () => {
    const ref = new Date(2025, 5, 15, 12, 0, 0);
    const sup = normalizeClientDebtLedger({
      suppliers: [
        {
          supplierId: 's',
          linkId: 'l',
          debts: [
            {
              id: 'd1',
              createdAt: '2025-01-01',
              origin: DEBT_ORIGIN.MANUAL,
              principalAmount: 100,
              interestRate: 10,
              startDate: '2025-01-01',
              status: DEBT_STATUS.ACTIVE,
              localNote: '',
              payments: [],
              dueDate: '2025-06-20',
            },
            {
              id: 'd2',
              createdAt: '2025-01-01',
              origin: DEBT_ORIGIN.MANUAL,
              principalAmount: 100,
              interestRate: 10,
              startDate: '2025-01-01',
              status: DEBT_STATUS.ACTIVE,
              localNote: '',
              payments: [],
              dueDate: '2025-06-01',
            },
          ],
        },
      ],
    }).suppliers[0];
    expect(deriveSupplierDueSummary(sup, ref).worstKind).toBe(DEBT_DUE_REMINDER_KIND.OVERDUE);

    const sup2 = normalizeClientDebtLedger({
      suppliers: [
        {
          supplierId: 's',
          linkId: 'l',
          debts: [
            {
              id: 'd1',
              createdAt: '2025-01-01',
              origin: DEBT_ORIGIN.MANUAL,
              principalAmount: 100,
              interestRate: 10,
              startDate: '2025-01-01',
              status: DEBT_STATUS.SETTLED_LOCALLY,
              localNote: '',
              payments: [],
              dueDate: '2025-01-01',
            },
            {
              id: 'd2',
              createdAt: '2025-01-01',
              origin: DEBT_ORIGIN.MANUAL,
              principalAmount: 100,
              interestRate: 10,
              startDate: '2025-01-01',
              status: DEBT_STATUS.ACTIVE,
              localNote: '',
              payments: [],
              dueDate: '2025-07-01',
            },
          ],
        },
      ],
    }).suppliers[0];
    expect(deriveSupplierDueSummary(sup2, ref).worstKind).toBe(DEBT_DUE_REMINDER_KIND.ON_TRACK);
  });

  it('deriveDebtDueReminder não altera deriveDebtSnapshot', () => {
    const debt = createManualDebtDraft({
      principalAmount: 500,
      interestRate: 10,
      startDate: '2025-01-01',
    });
    const withDue = normalizeClientDebtLedger({
      suppliers: [
        {
          supplierId: 's',
          linkId: 'l',
          debts: [{ ...debt, dueDate: '2025-06-20' }],
        },
      ],
    }).suppliers[0].debts[0];
    const ref = new Date(2025, 5, 15, 12, 0, 0);
    const snap0 = deriveDebtSnapshot(withDue, ref);
    deriveDebtDueReminder(withDue, ref);
    deriveDebtDueEffectiveIso(withDue, ref);
    const snap1 = deriveDebtSnapshot(withDue, ref);
    expect(snap1).toEqual(snap0);
  });

  it('calendarDaysBetweenIso mede dias civis', () => {
    expect(calendarDaysBetweenIso('2025-06-15', '2025-06-18')).toBe(3);
    expect(calendarDaysBetweenIso('2025-06-15', '2025-06-15')).toBe(0);
  });
});

describe('clientDebtLedger storage', () => {
  const scope = 'account:test-ledger-scope';

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(getScopedClientDebtLedgerKey(scope));
    }
  });

  it('load/save roundtrip mantém ledger separado', () => {
    const sup = createSupplierFromApprovedLink({
      id: 'L2',
      supplierId: 'S2',
      status: CLIENT_DEBT_LINK_APPROVED_STATUS,
    });
    let L = appendSupplierToLedgerIfMissing(emptyClientDebtLedger(), sup);
    const debt = createManualDebtDraft({
      principalAmount: 300,
      interestRate: 10,
      startDate: '2025-05-01',
    });
    L = appendDebtToSupplierLedger(L, 'S2', 'L2', debt);
    saveClientDebtLedger(L, scope);
    const loaded = loadClientDebtLedger(scope);
    expect(loaded.suppliers).toHaveLength(1);
    expect(loaded.suppliers[0].debts).toHaveLength(1);
    expect(loaded.suppliers[0].debts[0].principalAmount).toBe(300);
  });

  it('JSON inválido retorna ledger vazio', () => {
    localStorage.setItem(getScopedClientDebtLedgerKey(scope), '{not json');
    expect(loadClientDebtLedger(scope).suppliers).toEqual([]);
  });
});

describe('normalizePayment', () => {
  it('retorna null sem data ISO válida', () => {
    expect(normalizePayment({ id: '1', date: '', amount: 1 })).toBeNull();
  });
});

describe('sanitizeInterestRatePercent', () => {
  it('limita a 100%', () => {
    expect(sanitizeInterestRatePercent(200)).toBe(100);
  });
});
