import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDoc = vi.fn((_db, coll, id) => ({ path: `${coll}/${id}` }));
const mockGetDoc = vi.fn();
const mockUpdateDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  doc: (...args) => mockDoc(...args),
  deleteField: vi.fn(() => '__DELETE_FIELD__'),
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

const loanRequestsMod = await import('../loanRequests');
const {
  archiveLoanRequestForClient,
  unarchiveLoanRequestForClient,
  archiveLoanRequestForSupplier,
  unarchiveLoanRequestForSupplier,
} = await import('../loanRequestsFirestore');

describe('loanRequestsFirestore — arquivamento remoto A2b/A2c', () => {
  beforeEach(() => {
    mockDoc.mockClear();
    mockGetDoc.mockReset();
    mockUpdateDoc.mockReset();
  });

  it('archiveLoanRequestForClient grava apenas archivedByClientAt', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        clientId: 'cli-1',
        supplierId: 'sup-1',
        status: loanRequestsMod.LOAN_REQUEST_STATUSES.APPROVED,
      }),
    });

    const r = await archiveLoanRequestForClient({ requestId: 'lr-1', clientUid: 'cli-1' });

    expect(r.ok).toBe(true);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockUpdateDoc.mock.calls[0][1]).toEqual({
      [loanRequestsMod.LOAN_REQUEST_ARCHIVED_BY_CLIENT_AT_FIELD]: '__SERVER_TS__',
    });
  });

  it('unarchiveLoanRequestForClient remove campo com deleteField', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        clientId: 'cli-1',
        supplierId: 'sup-1',
        status: loanRequestsMod.LOAN_REQUEST_STATUSES.REJECTED,
      }),
    });

    const r = await unarchiveLoanRequestForClient({ requestId: 'lr-x', clientUid: 'cli-1' });

    expect(r.ok).toBe(true);
    expect(mockUpdateDoc.mock.calls[0][1]).toEqual({
      [loanRequestsMod.LOAN_REQUEST_ARCHIVED_BY_CLIENT_AT_FIELD]: '__DELETE_FIELD__',
    });
  });

  it('archiveLoanRequestForSupplier grava apenas archivedBySupplierAt', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        clientId: 'cli-1',
        supplierId: 'sup-1',
        status: loanRequestsMod.LOAN_REQUEST_STATUSES.CANCELLED_BY_CLIENT,
      }),
    });

    const r = await archiveLoanRequestForSupplier({ requestId: 'lr-s', supplierUid: 'sup-1' });

    expect(r.ok).toBe(true);
    expect(mockUpdateDoc.mock.calls[0][1]).toEqual({
      [loanRequestsMod.LOAN_REQUEST_ARCHIVED_BY_SUPPLIER_AT_FIELD]: '__SERVER_TS__',
    });
  });

  it('unarchiveLoanRequestForSupplier remove campo', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        clientId: 'cli-1',
        supplierId: 'sup-1',
        status: loanRequestsMod.LOAN_REQUEST_STATUSES.COUNTEROFFER_DECLINED,
      }),
    });

    const r = await unarchiveLoanRequestForSupplier({ requestId: 'lr-s2', supplierUid: 'sup-1' });

    expect(r.ok).toBe(true);
    expect(mockUpdateDoc.mock.calls[0][1]).toEqual({
      [loanRequestsMod.LOAN_REQUEST_ARCHIVED_BY_SUPPLIER_AT_FIELD]: '__DELETE_FIELD__',
    });
  });

  it('archiveLoanRequestForClient nega quando status não é terminal', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        clientId: 'cli-1',
        supplierId: 'sup-1',
        status: loanRequestsMod.LOAN_REQUEST_STATUSES.PENDING,
      }),
    });

    const r = await archiveLoanRequestForClient({ requestId: 'lr-open', clientUid: 'cli-1' });

    expect(r.ok).toBe(false);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});
