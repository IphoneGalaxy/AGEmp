import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUpdateProfile, authMock } = vi.hoisted(() => {
  return {
    mockUpdateProfile: vi.fn(),
    authMock: { currentUser: { uid: 'uid-1' } },
  };
});

const mockDoc = vi.fn((database, collectionName, userId) => ({
  database,
  path: `${collectionName}/${userId}`,
}));
const mockGetDoc = vi.fn();
const mockRunTransaction = vi.fn();
const mockServerTimestamp = vi.fn(() => 'SERVER_TIMESTAMP');
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();

vi.mock('firebase/auth', () => ({
  updateProfile: (user, profile) => mockUpdateProfile(user, profile),
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  runTransaction: mockRunTransaction,
  serverTimestamp: mockServerTimestamp,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
}));

vi.mock('../index', () => ({
  db: { name: 'mock-db' },
  get auth() {
    return authMock;
  },
}));

const usersModule = await import('../users');

const {
  addAccountRole,
  buildUserProfileData,
  createUserProfile,
  ensureUserProfileExists,
  getUserProfile,
  getUserProfileRef,
  setUserRole,
  updateUserDisplayName,
  updateUserDisplayNameWithAuthMirror,
} = usersModule;

describe('firebase/users', () => {
  beforeEach(() => {
    mockDoc.mockClear();
    mockGetDoc.mockReset();
    mockRunTransaction.mockReset();
    mockServerTimestamp.mockClear();
    mockSetDoc.mockReset();
    mockUpdateDoc.mockReset();
    mockUpdateProfile.mockReset();
    authMock.currentUser = { uid: 'uid-1' };
  });

  describe('buildUserProfileData', () => {
    it('usa o displayName do usuário quando existir', () => {
      const result = buildUserProfileData({
        displayName: '  Gui  ',
      });

      expect(result).toEqual({
        displayName: 'Gui',
        createdAt: 'SERVER_TIMESTAMP',
        updatedAt: 'SERVER_TIMESTAMP',
      });
      expect(mockServerTimestamp).toHaveBeenCalledTimes(2);
    });

    it('usa string vazia quando o usuário não tiver displayName', () => {
      const result = buildUserProfileData({});

      expect(result.displayName).toBe('');
    });
  });

  describe('getUserProfileRef', () => {
    it('aponta para users/{uid}', () => {
      const ref = getUserProfileRef('uid-123');

      expect(mockDoc).toHaveBeenCalledWith({ name: 'mock-db' }, 'users', 'uid-123');
      expect(ref.path).toBe('users/uid-123');
    });
  });

  describe('getUserProfile', () => {
    it('retorna null quando uid está vazio', async () => {
      await expect(getUserProfile('')).resolves.toBeNull();
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it('retorna null quando o documento não existe', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(getUserProfile('uid-1')).resolves.toBeNull();
    });

    it('retorna os dados quando o documento existe', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ displayName: 'Gui' }),
      });

      await expect(getUserProfile('uid-1')).resolves.toEqual({ displayName: 'Gui' });
    });
  });

  describe('updateUserDisplayName', () => {
    it('retorna erro quando uid está vazio', async () => {
      await expect(updateUserDisplayName('', 'Gui')).resolves.toEqual({
        ok: false,
        message: 'Perfil remoto indisponível neste ambiente.',
      });
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('rejeita nome acima do limite', async () => {
      const longName = 'x'.repeat(81);
      await expect(updateUserDisplayName('uid-1', longName)).resolves.toEqual({
        ok: false,
        message: 'Nome muito longo (máx. 80 caracteres).',
      });
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('atualiza displayName e updatedAt', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await expect(updateUserDisplayName('uid-1', '  Gui  ')).resolves.toEqual({ ok: true });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        { database: { name: 'mock-db' }, path: 'users/uid-1' },
        {
          displayName: 'Gui',
          updatedAt: 'SERVER_TIMESTAMP',
        }
      );
    });
  });

  describe('setUserRole', () => {
    it('retorna erro quando uid está vazio', async () => {
      await expect(setUserRole('', 'supplier')).resolves.toEqual({
        ok: false,
        message: 'Perfil remoto indisponível neste ambiente.',
      });
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('rejeita papel fora do enum', async () => {
      await expect(setUserRole('uid-1', 'admin')).resolves.toEqual({
        ok: false,
        message: 'Papel inválido. Use supplier ou client.',
      });
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('salva role, roleSetAt, accountRoles e updatedAt', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await expect(setUserRole('uid-1', 'supplier')).resolves.toEqual({ ok: true });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        { database: { name: 'mock-db' }, path: 'users/uid-1' },
        {
          role: 'supplier',
          roleSetAt: 'SERVER_TIMESTAMP',
          updatedAt: 'SERVER_TIMESTAMP',
          accountRoles: ['supplier'],
        }
      );
    });
  });

  describe('addAccountRole', () => {
    it('retorna ok sem gravar quando o papel já está nos efetivos', async () => {
      const transactionUpdate = vi.fn();
      mockRunTransaction.mockImplementation(async (_database, callback) => {
        const transaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              role: 'client',
              accountRoles: ['client'],
            }),
          }),
          update: transactionUpdate,
        };
        return callback(transaction);
      });

      await expect(addAccountRole('uid-1', 'client')).resolves.toEqual({ ok: true });
      expect(transactionUpdate).not.toHaveBeenCalled();
    });

    it('acrescenta o segundo papel quando há apenas um efetivo', async () => {
      const transactionUpdate = vi.fn();
      mockRunTransaction.mockImplementation(async (_database, callback) => {
        const transaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              role: 'client',
              accountRoles: ['client'],
            }),
          }),
          update: transactionUpdate,
        };
        return callback(transaction);
      });

      await expect(addAccountRole('uid-1', 'supplier')).resolves.toEqual({ ok: true });

      expect(transactionUpdate).toHaveBeenCalledWith(
        { database: { name: 'mock-db' }, path: 'users/uid-1' },
        {
          accountRoles: ['client', 'supplier'],
          updatedAt: 'SERVER_TIMESTAMP',
        }
      );
    });

    it('inicializa accountRoles a partir do legado quando o campo ainda não existe', async () => {
      const transactionUpdate = vi.fn();
      mockRunTransaction.mockImplementation(async (_database, callback) => {
        const transaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              role: 'client',
              roleSetAt: 't0',
            }),
          }),
          update: transactionUpdate,
        };
        return callback(transaction);
      });

      await expect(addAccountRole('uid-1', 'supplier')).resolves.toEqual({ ok: true });

      expect(transactionUpdate).toHaveBeenCalledWith(
        { database: { name: 'mock-db' }, path: 'users/uid-1' },
        {
          accountRoles: ['client', 'supplier'],
          updatedAt: 'SERVER_TIMESTAMP',
        }
      );
    });
  });

  describe('updateUserDisplayNameWithAuthMirror', () => {
    it('sincroniza o Auth após sucesso no Firestore', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      mockUpdateProfile.mockResolvedValue(undefined);

      const user = { uid: 'uid-1' };
      await expect(updateUserDisplayNameWithAuthMirror(user, '  Gui  ')).resolves.toEqual({ ok: true });

      expect(mockUpdateProfile).toHaveBeenCalledWith(
        { uid: 'uid-1' },
        { displayName: 'Gui' }
      );
    });

    it('envia null ao Auth quando o nome fica vazio', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      mockUpdateProfile.mockResolvedValue(undefined);

      await updateUserDisplayNameWithAuthMirror({ uid: 'uid-1' }, '   ');

      expect(mockUpdateProfile).toHaveBeenCalledWith({ uid: 'uid-1' }, { displayName: null });
    });

    it('não chama updateProfile se o Firestore falhar', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('fail'));

      await expect(
        updateUserDisplayNameWithAuthMirror({ uid: 'uid-1' }, 'Gui')
      ).resolves.toMatchObject({ ok: false, stage: 'firestore' });

      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });

    it('retorna aviso se o Auth não puder ser atualizado (espelho)', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      mockUpdateProfile.mockRejectedValue({ code: 'auth/internal-error' });

      await expect(updateUserDisplayNameWithAuthMirror({ uid: 'uid-1' }, 'Gui')).resolves.toEqual({
        ok: true,
        authSyncFailed: true,
        message: 'Erro temporário. Tente novamente em instantes.',
      });
    });

    it('não chama updateProfile se currentUser for outro uid', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      authMock.currentUser = { uid: 'outro' };

      const result = await updateUserDisplayNameWithAuthMirror({ uid: 'uid-1' }, 'Gui');
      expect(result).toEqual({
        ok: true,
        authSyncFailed: true,
        message: expect.stringContaining('Sessão desatualizada'),
      });
      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });
  });

  describe('createUserProfile', () => {
    it('cria o documento mínimo do usuário autenticado', async () => {
      await createUserProfile({
        uid: 'uid-1',
        displayName: 'Gui',
      });

      expect(mockSetDoc).toHaveBeenCalledWith(
        { database: { name: 'mock-db' }, path: 'users/uid-1' },
        {
          displayName: 'Gui',
          createdAt: 'SERVER_TIMESTAMP',
          updatedAt: 'SERVER_TIMESTAMP',
        }
      );
    });
  });

  describe('ensureUserProfileExists', () => {
    it('não faz nada quando não há usuário autenticado', async () => {
      await expect(ensureUserProfileExists(null)).resolves.toEqual({
        created: false,
        profile: null,
      });
      expect(mockGetDoc).not.toHaveBeenCalled();
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('não sobrescreve perfil existente', async () => {
      mockRunTransaction.mockImplementation(async (_database, callback) => {
        const transaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({ displayName: 'Gui' }),
          }),
          set: vi.fn(),
        };
        return callback(transaction);
      });

      await expect(
        ensureUserProfileExists({
          uid: 'uid-1',
          displayName: 'Outro nome',
        })
      ).resolves.toEqual({
        created: false,
        profile: { displayName: 'Gui' },
      });

      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('cria o perfil quando ainda não existe', async () => {
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
        ensureUserProfileExists({
          uid: 'uid-1',
          displayName: 'Gui',
        })
      ).resolves.toEqual({
        created: true,
        profile: null,
      });

      expect(transactionSet).toHaveBeenCalledTimes(1);
    });
  });
});
