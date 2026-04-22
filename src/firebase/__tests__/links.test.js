import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetUserProfile } = vi.hoisted(() => ({
  mockGetUserProfile: vi.fn(),
}));

const mockDoc = vi.fn((database, collectionName, documentId) => ({
  database,
  id: documentId,
  path: `${collectionName}/${documentId}`,
}));
const mockCollection = vi.fn((database, name) => ({ database, name }));
const mockQuery = vi.fn((colRef, ...constraints) => ({ colRef, constraints }));
const mockWhere = vi.fn((field, op, value) => ({ field, op, value }));
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockRunTransaction = vi.fn();
const mockServerTimestamp = vi.fn(() => 'SERVER_TIMESTAMP');
const mockUpdateDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  runTransaction: mockRunTransaction,
  serverTimestamp: mockServerTimestamp,
  updateDoc: mockUpdateDoc,
  where: mockWhere,
}));

vi.mock('../index', () => ({
  db: { name: 'mock-db' },
}));

vi.mock('../users', () => ({
  getUserProfile: (...args) => mockGetUserProfile(...args),
}));

const linksModule = await import('../links');

const {
  LINK_REQUESTED_BY,
  LINK_STATUSES,
  buildLinkData,
  canActorTransitionLinkStatus,
  createLinkRequest,
  formatLinkWritePayloadForDevLog,
  getLink,
  getLinkId,
  getLinkRef,
  getLinkStatusLabelPt,
  listUserLinks,
  transitionLinkStatus,
} = linksModule;

describe('firebase/links', () => {
  beforeEach(() => {
    mockGetUserProfile.mockReset();
    mockGetUserProfile.mockImplementation(async (uid) => {
      if (uid === 'supplier-1') return { role: 'supplier' };
      if (uid === 'client-1') return { role: 'client' };
      return null;
    });
    mockCollection.mockClear();
    mockDoc.mockClear();
    mockGetDoc.mockReset();
    mockGetDocs.mockReset();
    mockQuery.mockClear();
    mockRunTransaction.mockReset();
    mockServerTimestamp.mockClear();
    mockUpdateDoc.mockReset();
    mockWhere.mockClear();
  });

  describe('buildLinkData', () => {
    it('cria um vínculo pendente iniciado pelo cliente', () => {
      const result = buildLinkData({
        supplierId: 'supplier-1',
        clientId: 'client-1',
      });

      expect(result).toEqual({
        supplierId: 'supplier-1',
        clientId: 'client-1',
        status: LINK_STATUSES.PENDING,
        requestedBy: LINK_REQUESTED_BY.CLIENT,
        createdAt: 'SERVER_TIMESTAMP',
        updatedAt: 'SERVER_TIMESTAMP',
      });
      expect(mockServerTimestamp).toHaveBeenCalledTimes(1);
      expect(result.createdAt).toBe(result.updatedAt);
    });
  });

  describe('formatLinkWritePayloadForDevLog', () => {
    it('indica quando createdAt e updatedAt compartilham a mesma referência', () => {
      const ts = {};
      const payload = {
        supplierId: 's',
        clientId: 'c',
        status: LINK_STATUSES.PENDING,
        requestedBy: LINK_REQUESTED_BY.CLIENT,
        createdAt: ts,
        updatedAt: ts,
      };
      expect(formatLinkWritePayloadForDevLog(payload)).toEqual({
        supplierId: 's',
        clientId: 'c',
        status: LINK_STATUSES.PENDING,
        requestedBy: LINK_REQUESTED_BY.CLIENT,
        createdAt: '[FieldValue.serverTimestamp]',
        updatedAt: '[FieldValue.serverTimestamp]',
        createdAtAndUpdatedAtSameReference: true,
      });
    });
  });

  describe('getLinkStatusLabelPt', () => {
    it('traduz status conhecidos para português', () => {
      expect(getLinkStatusLabelPt(LINK_STATUSES.PENDING)).toBe('Pendente');
      expect(getLinkStatusLabelPt(LINK_STATUSES.APPROVED)).toBe('Aprovado');
      expect(getLinkStatusLabelPt(LINK_STATUSES.REJECTED)).toBe('Recusado');
    });

    it('retorna string vazia para valor não string', () => {
      expect(getLinkStatusLabelPt(null)).toBe('');
    });
  });

  describe('listUserLinks', () => {
    it('retorna array vazio quando uid ausente', async () => {
      await expect(listUserLinks('')).resolves.toEqual([]);
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it('deduplica por id quando as duas consultas retornam o mesmo documento', async () => {
      const snapshot = {
        forEach(fn) {
          fn({
            id: 'supplier-1__client-1',
            data: () => ({
              supplierId: 'supplier-1',
              clientId: 'client-1',
              status: LINK_STATUSES.PENDING,
            }),
          });
        },
      };
      mockGetDocs.mockResolvedValue(snapshot);

      await expect(listUserLinks('supplier-1')).resolves.toEqual([
        {
          id: 'supplier-1__client-1',
          supplierId: 'supplier-1',
          clientId: 'client-1',
          status: LINK_STATUSES.PENDING,
        },
      ]);

      expect(mockGetDocs).toHaveBeenCalledTimes(2);
      expect(mockCollection).toHaveBeenCalledWith({ name: 'mock-db' }, 'links');
      expect(mockWhere).toHaveBeenCalledWith('supplierId', '==', 'supplier-1');
      expect(mockWhere).toHaveBeenCalledWith('clientId', '==', 'supplier-1');
    });
  });

  describe('getLinkId', () => {
    it('usa um id determinístico por par fornecedor-cliente', () => {
      expect(getLinkId('supplier-1', 'client-1')).toBe('supplier-1__client-1');
    });
  });

  describe('getLinkRef', () => {
    it('aponta para links/{supplierId__clientId}', () => {
      const ref = getLinkRef('supplier-1', 'client-1');

      expect(mockDoc).toHaveBeenCalledWith(
        { name: 'mock-db' },
        'links',
        'supplier-1__client-1'
      );
      expect(ref.path).toBe('links/supplier-1__client-1');
    });
  });

  describe('canActorTransitionLinkStatus', () => {
    it('permite aprovação pelo fornecedor a partir de pending', () => {
      expect(
        canActorTransitionLinkStatus('supplier', LINK_STATUSES.PENDING, LINK_STATUSES.APPROVED)
      ).toBe(true);
    });

    it('bloqueia aprovação pelo cliente', () => {
      expect(
        canActorTransitionLinkStatus('client', LINK_STATUSES.PENDING, LINK_STATUSES.APPROVED)
      ).toBe(false);
    });

    it('permite cancelamento pelo cliente enquanto pending', () => {
      expect(
        canActorTransitionLinkStatus(
          'client',
          LINK_STATUSES.PENDING,
          LINK_STATUSES.CANCELLED_BY_CLIENT
        )
      ).toBe(true);
    });

    it('permite revogação pelo fornecedor depois de approved', () => {
      expect(
        canActorTransitionLinkStatus(
          'supplier',
          LINK_STATUSES.APPROVED,
          LINK_STATUSES.REVOKED_BY_SUPPLIER
        )
      ).toBe(true);
    });
  });

  describe('getLink', () => {
    it('retorna null quando faltam ids', async () => {
      await expect(getLink('', 'client-1')).resolves.toBeNull();
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it('retorna null quando o documento não existe', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(getLink('supplier-1', 'client-1')).resolves.toBeNull();
    });

    it('retorna os dados do vínculo quando existir', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ status: LINK_STATUSES.PENDING }),
      });

      await expect(getLink('supplier-1', 'client-1')).resolves.toEqual({
        id: 'supplier-1__client-1',
        status: LINK_STATUSES.PENDING,
      });
    });
  });

  describe('createLinkRequest', () => {
    it('valida fornecedor e cliente diferentes', async () => {
      await expect(
        createLinkRequest({ supplierId: 'same-id', clientId: 'same-id' })
      ).resolves.toEqual({
        ok: false,
        message: 'Fornecedor e cliente devem ser contas diferentes.',
      });
      expect(mockRunTransaction).not.toHaveBeenCalled();
      expect(mockGetUserProfile).not.toHaveBeenCalled();
    });

    it('não duplica vínculo existente', async () => {
      mockRunTransaction.mockImplementation(async (_database, callback) => {
        const transaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
          }),
          set: vi.fn(),
        };
        return callback(transaction);
      });

      await expect(
        createLinkRequest({ supplierId: 'supplier-1', clientId: 'client-1' })
      ).resolves.toEqual({
        ok: false,
        message: 'Já existe um vínculo ou solicitação entre estas contas.',
      });
    });

    it('cria a solicitação pendente com id determinístico', async () => {
      const transactionSet = vi.fn();
      mockRunTransaction.mockImplementation(async (_database, callback) => {
        const transaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => false,
          }),
          set: transactionSet,
        };
        return callback(transaction);
      });

      await expect(
        createLinkRequest({ supplierId: 'supplier-1', clientId: 'client-1' })
      ).resolves.toEqual({
        ok: true,
        id: 'supplier-1__client-1',
      });

      expect(transactionSet).toHaveBeenCalledWith(
        {
          database: { name: 'mock-db' },
          id: 'supplier-1__client-1',
          path: 'links/supplier-1__client-1',
        },
        {
          supplierId: 'supplier-1',
          clientId: 'client-1',
          status: LINK_STATUSES.PENDING,
          requestedBy: LINK_REQUESTED_BY.CLIENT,
          createdAt: 'SERVER_TIMESTAMP',
          updatedAt: 'SERVER_TIMESTAMP',
        }
      );
    });

    it('não chama transação quando não há perfil do fornecedor para o UID', async () => {
      mockGetUserProfile.mockImplementation(async (uid) => {
        if (uid === 'client-1') return { role: 'client' };
        return null;
      });

      await expect(
        createLinkRequest({ supplierId: 'no-such-user', clientId: 'client-1' })
      ).resolves.toMatchObject({
        ok: false,
        message: expect.stringMatching(/Não há perfil remoto com este UID/i),
      });
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it('não chama transação quando o fornecedor existe mas não é supplier', async () => {
      mockGetUserProfile.mockImplementation(async (uid) => {
        if (uid === 'client-1') return { role: 'client' };
        if (uid === 'supplier-1') return { role: 'client' };
        return null;
      });

      await expect(
        createLinkRequest({ supplierId: 'supplier-1', clientId: 'client-1' })
      ).resolves.toMatchObject({
        ok: false,
        message: expect.stringMatching(/Fornecedor \(conta\)/i),
      });
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it('não chama transação quando a conta atual não é client no servidor', async () => {
      mockGetUserProfile.mockImplementation(async (uid) => {
        if (uid === 'client-1') return { role: 'supplier' };
        if (uid === 'supplier-1') return { role: 'supplier' };
        return null;
      });

      await expect(
        createLinkRequest({ supplierId: 'supplier-1', clientId: 'client-1' })
      ).resolves.toMatchObject({
        ok: false,
        message: expect.stringMatching(/Cliente \(conta\)/i),
      });
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it('aceita fornecedor só com accountRoles válido (sem depender do legado)', async () => {
      mockGetUserProfile.mockImplementation(async (uid) => {
        if (uid === 'client-1') return { role: 'client', accountRoles: ['client'] };
        if (uid === 'supplier-1') return { accountRoles: ['supplier'] };
        return null;
      });
      mockRunTransaction.mockImplementation(async (_database, callback) => {
        const transaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => false,
          }),
          set: vi.fn(),
        };
        return callback(transaction);
      });

      await expect(
        createLinkRequest({ supplierId: 'supplier-1', clientId: 'client-1' })
      ).resolves.toEqual({ ok: true, id: 'supplier-1__client-1' });
    });
  });

  describe('transitionLinkStatus', () => {
    it('bloqueia transição inválida pelo papel informado', async () => {
      await expect(
        transitionLinkStatus({
          supplierId: 'supplier-1',
          clientId: 'client-1',
          actorRole: 'client',
          currentStatus: LINK_STATUSES.PENDING,
          nextStatus: LINK_STATUSES.APPROVED,
        })
      ).resolves.toEqual({
        ok: false,
        message: 'Transição de vínculo inválida para o papel informado.',
      });

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('atualiza o status quando a transição é válida', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await expect(
        transitionLinkStatus({
          supplierId: 'supplier-1',
          clientId: 'client-1',
          actorRole: 'supplier',
          currentStatus: LINK_STATUSES.PENDING,
          nextStatus: LINK_STATUSES.APPROVED,
        })
      ).resolves.toEqual({ ok: true });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        {
          database: { name: 'mock-db' },
          id: 'supplier-1__client-1',
          path: 'links/supplier-1__client-1',
        },
        {
          status: LINK_STATUSES.APPROVED,
          updatedAt: 'SERVER_TIMESTAMP',
        }
      );
    });
  });
});
