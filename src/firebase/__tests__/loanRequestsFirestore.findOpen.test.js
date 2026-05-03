import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: (...args) => mockCollection(...args),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: (...args) => mockGetDocs(...args),
  limit: (...args) => mockLimit(...args),
  orderBy: vi.fn(),
  query: (...args) => mockQuery(...args),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
  where: (...args) => mockWhere(...args),
}));

vi.mock('../index', () => ({
  db: { name: 'mock-db' },
}));

const loanRequestsMod = await import('../loanRequests');
const { findOpenLoanRequestForLinkId } = await import('../loanRequestsFirestore');

describe('loanRequestsFirestore — findOpenLoanRequestForLinkId', () => {
  beforeEach(() => {
    mockCollection.mockClear();
    mockQuery.mockClear();
    mockWhere.mockClear();
    mockLimit.mockClear();
    mockGetDocs.mockReset();
    mockWhere.mockImplementation((field, op, val) => ({ field, op, val }));
    mockLimit.mockImplementation((n) => ({ limit: n }));
    mockQuery.mockImplementation((col, ...constraints) => ({ col, constraints }));
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
    mockCollection.mockReturnValue({ id: 'loanRequests' });
  });

  it('não consulta quando faltam linkId ou clientId', async () => {
    await expect(findOpenLoanRequestForLinkId('', 'client-1')).resolves.toEqual({
      exists: false,
    });
    await expect(findOpenLoanRequestForLinkId('link-a', '')).resolves.toEqual({
      exists: false,
    });
    await expect(findOpenLoanRequestForLinkId('link-only')).resolves.toEqual({
      exists: false,
    });
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('combina clientId + linkId + status in (opens) para compatibilidade com Security Rules', async () => {
    const r = await findOpenLoanRequestForLinkId('supplierX__clientY', 'clientY');
    expect(r).toEqual({ exists: false });
    expect(mockWhere).toHaveBeenCalledWith('clientId', '==', 'clientY');
    expect(mockWhere).toHaveBeenCalledWith('linkId', '==', 'supplierX__clientY');
    expect(mockWhere).toHaveBeenCalledWith(
      'status',
      'in',
      expect.arrayContaining([...loanRequestsMod.LOAN_REQUEST_OPEN_STATUSES])
    );
    expect(mockLimit).toHaveBeenCalledWith(1);
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
  });
});
