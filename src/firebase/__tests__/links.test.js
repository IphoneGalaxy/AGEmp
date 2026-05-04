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
      if (uid === 'supplier-1') return { role: 'supplier', displayName: 'Fornecedor Snap' };
      if (uid === 'client-1') return { role: 'client', displayName: 'Cliente Snap' };
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

    it('espelha snapshots quando presentes no payload', () => {
      const ts = {};
      expect(
        formatLinkWritePayloadForDevLog({
          supplierId: 's',
          clientId: 'c',
          status: LINK_STATUSES.PENDING,
          requestedBy: LINK_REQUESTED_BY.CLIENT,
          createdAt: ts,
          updatedAt: ts,
          clientDisplayNameSnapshot: 'Cliente',
          supplierDisplayNameSnapshot: 'Fornecedor',
        }),
      ).toMatchObject({
        clientDisplayNameSnapshot: 'Cliente',
        supplierDisplayNameSnapshot: 'Fornecedor',
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

    it('permite novo pedido pelo cliente depois de recusado pelo fornecedor', () => {
      expect(
        canActorTransitionLinkStatus('client', LINK_STATUSES.REJECTED, LINK_STATUSES.PENDING)
      ).toBe(true);
    });

    it('permite novo pedido depois de revogação pelo fornecedor', () => {
      expect(
        canActorTransitionLinkStatus(
          'client',
          LINK_STATUSES.REVOKED_BY_SUPPLIER,
          LINK_STATUSES.PENDING
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

    it('não duplica quando já existe vínculo pendente', async () => {
      mockRunTransaction.mockImplementation(async (_database, callback) => {
        const transaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              supplierId: 'supplier-1',
              clientId: 'client-1',
              status: LINK_STATUSES.PENDING,
              requestedBy: LINK_REQUESTED_BY.CLIENT,
            }),
          }),
          set: vi.fn(),
          update: vi.fn(),
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

    it('não duplica quando já existe vínculo aprovado', async () => {
      mockRunTransaction.mockImplementation(async (_database, callback) => {
        const transaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              supplierId: 'supplier-1',
              clientId: 'client-1',
              status: LINK_STATUSES.APPROVED,
              requestedBy: LINK_REQUESTED_BY.CLIENT,
            }),
          }),
          set: vi.fn(),
          update: vi.fn(),
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

    it('reabre solicitação após vínculo recusado (mesmo doc)', async () => {
      const transactionUpdate = vi.fn();
      mockRunTransaction.mockImplementation(async (_database, callback) => {
        const transaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              supplierId: 'supplier-1',
              clientId: 'client-1',
              status: LINK_STATUSES.REJECTED,
              requestedBy: LINK_REQUESTED_BY.CLIENT,
            }),
          }),
          set: vi.fn(),
          update: transactionUpdate,
        };
        return callback(transaction);
      });

      await expect(
        createLinkRequest({ supplierId: 'supplier-1', clientId: 'client-1' })
      ).resolves.toEqual({ ok: true, id: 'supplier-1__client-1' });

      expect(transactionUpdate).toHaveBeenCalledTimes(1);
      expect(transactionUpdate.mock.calls[0][1]).toMatchObject({
        status: LINK_STATUSES.PENDING,
        updatedAt: 'SERVER_TIMESTAMP',
      });
      expect(transactionUpdate.mock.calls[0][1].supplierId).toBeUndefined();
    });

    it('reabre após vínculo revogado pelo fornecedor', async () => {
      mockRunTransaction.mockImplementation(async (_database, callback) => {
        const transaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              supplierId: 'supplier-1',
              clientId: 'client-1',
              status: LINK_STATUSES.REVOKED_BY_SUPPLIER,
              requestedBy: LINK_REQUESTED_BY.CLIENT,
            }),
          }),
          set: vi.fn(),
          update: vi.fn(),
        };
        return callback(transaction);
      });

      await expect(
        createLinkRequest({ supplierId: 'supplier-1', clientId: 'client-1' })
      ).resolves.toEqual({ ok: true, id: 'supplier-1__client-1' });
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
          clientDisplayNameSnapshot: 'Cliente Snap',
        }
      );
    });

    it('primeira criação omite clientDisplayNameSnapshot quando displayName do cliente está vazio', async () => {
      mockGetUserProfile.mockImplementation(async (uid) => {
        if (uid === 'supplier-1') return { role: 'supplier', displayName: 'S' };
        if (uid === 'client-1') return { role: 'client', displayName: '' };
        return null;
      });

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
      ).resolves.toEqual({ ok: true, id: 'supplier-1__client-1' });

      const payload = transactionSet.mock.calls[0][1];
      expect(payload).not.toHaveProperty('clientDisplayNameSnapshot');
      expect(payload).not.toHaveProperty('supplierDisplayNameSnapshot');
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
          supplierDisplayNameSnapshot: 'Fornecedor Snap',
        }
      );
    });

    it('recusa vínculo pendente sem gravar supplierDisplayNameSnapshot', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await expect(
        transitionLinkStatus({
          supplierId: 'supplier-1',
          clientId: 'client-1',
          actorRole: 'supplier',
          currentStatus: LINK_STATUSES.PENDING,
          nextStatus: LINK_STATUSES.REJECTED,
        })
      ).resolves.toEqual({ ok: true });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        {
          database: { name: 'mock-db' },
          id: 'supplier-1__client-1',
          path: 'links/supplier-1__client-1',
        },
        {
          status: LINK_STATUSES.REJECTED,
          updatedAt: 'SERVER_TIMESTAMP',
        },
      );
      expect(mockUpdateDoc.mock.calls[0][1]).not.toHaveProperty('supplierDisplayNameSnapshot');
    });

    it('aprovação omite supplierDisplayNameSnapshot quando displayName do fornecedor está vazio', async () => {
      mockGetUserProfile.mockImplementation(async (uid) => {
        if (uid === 'supplier-1') return { role: 'supplier', displayName: '' };
        if (uid === 'client-1') return { role: 'client' };
        return null;
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await expect(
        transitionLinkStatus({
          supplierId: 'supplier-1',
          clientId: 'client-1',
          actorRole: 'supplier',
          currentStatus: LINK_STATUSES.PENDING,
          nextStatus: LINK_STATUSES.APPROVED,
        }),
      ).resolves.toEqual({ ok: true });

      expect(mockUpdateDoc.mock.calls[0][1]).toEqual({
        status: LINK_STATUSES.APPROVED,
        updatedAt: 'SERVER_TIMESTAMP',
      });
      expect(mockUpdateDoc.mock.calls[0][1]).not.toHaveProperty('supplierDisplayNameSnapshot');
    });
  });
});
