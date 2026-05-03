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
  db: { name: 'mock-db' },
}));

const {
  markLoanRequestReadByClient,
  markLoanRequestReadBySupplier,
} = await import('../loanRequestsFirestore');
const loanRequestsMod = await import('../loanRequests');

describe('loanRequestsFirestore — marcadores RB (v1.1)', () => {
  beforeEach(() => {
    mockDoc.mockClear();
    mockGetDoc.mockReset();
    mockUpdateDoc.mockReset();
  });

  it('markLoanRequestReadByClient grava apenas readByClientAt', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ clientId: 'cli-1', supplierId: 'sup-1' }),
    });

    const r = await markLoanRequestReadByClient({ requestId: 'lr-1', clientUid: 'cli-1' });

    expect(r.ok).toBe(true);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockUpdateDoc.mock.calls[0][1]).toEqual({
      [loanRequestsMod.LOAN_REQUEST_READ_BY_CLIENT_AT_FIELD]: '__SERVER_TS__',
    });
  });

  it('markLoanRequestReadByClient falha quando clientId diverge', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ clientId: 'other', supplierId: 'sup-1' }),
    });

    const r = await markLoanRequestReadByClient({ requestId: 'lr-1', clientUid: 'cli-1' });

    expect(r.ok).toBe(false);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
    expect(typeof r.message).toBe('string');
    expect(r.message.length).toBeGreaterThan(0);
  });

  it('markLoanRequestReadBySupplier grava apenas readBySupplierAt', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ clientId: 'cli-1', supplierId: 'sup-1' }),
    });

    const r = await markLoanRequestReadBySupplier({
      requestId: 'lr-2',
      supplierUid: 'sup-1',
    });

    expect(r.ok).toBe(true);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockUpdateDoc.mock.calls[0][1]).toEqual({
      [loanRequestsMod.LOAN_REQUEST_READ_BY_SUPPLIER_AT_FIELD]: '__SERVER_TS__',
    });
  });

  it('markLoanRequestReadBySupplier falha quando supplierId diverge', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ clientId: 'cli-1', supplierId: 'other' }),
    });

    const r = await markLoanRequestReadBySupplier({
      requestId: 'lr-2',
      supplierUid: 'sup-1',
    });

    expect(r.ok).toBe(false);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});
