import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDoc = vi.fn((database, coll, id) => ({ path: `${coll}/${id}` }));
const mockGetDoc = vi.fn();
const mockUpdateDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(() => '__SERVER_TS__'),
  updateDoc: (...args) => mockUpdateDoc(...args),
  where: vi.fn(),
}));

vi.mock('../index', () => ({
  app: null,
  auth: { currentUser: null },
  db: { name: 'mock-db' },
}));

const { LOAN_REQUEST_STATUSES } = await import('../loanRequests');
const {
  supplierProposeLoanRequestCounteroffer,
  clientAcceptLoanRequestCounteroffer,
  clientDeclineLoanRequestCounteroffer,
} = await import('../loanRequestsFirestore');

const baseSupplierDoc = Object.freeze({
  supplierId: 'sup-1',
  clientId: 'cli-1',
  requestedAmount: 10000,
  status: LOAN_REQUEST_STATUSES.PENDING,
});

describe('loanRequestsFirestore — contraposta v1.1 CN', () => {
  beforeEach(() => {
    mockDoc.mockClear();
    mockGetDoc.mockReset();
    mockUpdateDoc.mockReset();
  });

  it('supplierPropõe contraposta válida e atualiza status / campos', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ ...baseSupplierDoc }),
    });

    const r = await supplierProposeLoanRequestCounteroffer({
      requestId: 'lr-co-1',
      supplierUid: 'sup-1',
      counterofferAmountCents: 12000,
    });

    expect(r.ok).toBe(true);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.status).toBe(LOAN_REQUEST_STATUSES.COUNTEROFFER);
    expect(payload.counterofferAmount).toBe(12000);
    expect(payload.counterofferedAt).toBe(payload.updatedAt);
  });

  it('bloqueia valor igual ao solicitado', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ ...baseSupplierDoc }),
    });

    const r = await supplierProposeLoanRequestCounteroffer({
      requestId: 'lr-co-2',
      supplierUid: 'sup-1',
      counterofferAmountCents: 10000,
    });

    expect(r.ok).toBe(false);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('bloqueia segunda rodada se já há contraposta', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        ...baseSupplierDoc,
        status: LOAN_REQUEST_STATUSES.PENDING,
        counterofferAmount: 12000,
        counterofferedAt: { seconds: 1, nanoseconds: 0 },
      }),
    });

    const r = await supplierProposeLoanRequestCounteroffer({
      requestId: 'lr-co-3',
      supplierUid: 'sup-1',
      counterofferAmountCents: 13000,
    });

    expect(r.ok).toBe(false);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('bloqueia valor fora dos limites', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ ...baseSupplierDoc }),
    });

    const r = await supplierProposeLoanRequestCounteroffer({
      requestId: 'lr-co-4',
      supplierUid: 'sup-1',
      counterofferAmountCents: 0,
    });

    expect(r.ok).toBe(false);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('cliente aceita contraposta e define approvedAmount = counterofferAmount', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        ...baseSupplierDoc,
        status: LOAN_REQUEST_STATUSES.COUNTEROFFER,
        counterofferAmount: 8888,
      }),
    });

    const r = await clientAcceptLoanRequestCounteroffer({
      requestId: 'lr-acc-1',
      clientUid: 'cli-1',
    });

    expect(r.ok).toBe(true);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.status).toBe(LOAN_REQUEST_STATUSES.APPROVED);
    expect(payload.approvedAmount).toBe(8888);
    expect(payload.respondedAt).toBe(payload.updatedAt);
  });

  it('cliente declina contraposta (terminal pré-financeiro)', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        ...baseSupplierDoc,
        status: LOAN_REQUEST_STATUSES.COUNTEROFFER,
        counterofferAmount: 8888,
      }),
    });

    const r = await clientDeclineLoanRequestCounteroffer({
      requestId: 'lr-dec-1',
      clientUid: 'cli-1',
    });

    expect(r.ok).toBe(true);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.status).toBe(LOAN_REQUEST_STATUSES.COUNTEROFFER_DECLINED);
    expect(payload.respondedAt).toBe(payload.updatedAt);
  });
});
