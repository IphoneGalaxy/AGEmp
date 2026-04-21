import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDoc = vi.fn((database, collectionName, userId) => ({
  database,
  path: `${collectionName}/${userId}`,
}));
const mockGetDoc = vi.fn();
const mockRunTransaction = vi.fn();
const mockServerTimestamp = vi.fn(() => 'SERVER_TIMESTAMP');
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();

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
}));

const usersModule = await import('../users');

const {
  buildUserProfileData,
  createUserProfile,
  ensureUserProfileExists,
  getUserProfile,
  getUserProfileRef,
  updateUserDisplayName,
} = usersModule;

describe('firebase/users', () => {
  beforeEach(() => {
    mockDoc.mockClear();
    mockGetDoc.mockReset();
    mockRunTransaction.mockReset();
    mockServerTimestamp.mockClear();
    mockSetDoc.mockReset();
    mockUpdateDoc.mockReset();
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
