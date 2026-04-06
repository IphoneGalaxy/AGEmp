/**
 * Testes unitários para o módulo de backup automático (autoBackup.js).
 *
 * Cobertura:
 * - getAutoBackups: localStorage vazio, com dados, corrompido
 * - createAutoBackup: criação, limite, rotação
 * - getLastAutoBackup: com e sem backups
 * - restoreAutoBackup: índice válido, inválido
 * - getAutoBackupCount: contagem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAutoBackups,
  createAutoBackup,
  getLastAutoBackup,
  restoreAutoBackup,
  getAutoBackupCount,
} from '../autoBackup';

const AUTO_BACKUP_KEY = 'loanManagerAutoBackups';

describe('autoBackup', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ==================== getAutoBackups ====================

  describe('getAutoBackups', () => {
    it('retorna array vazio quando localStorage está vazio', () => {
      expect(getAutoBackups()).toEqual([]);
    });

    it('retorna backups armazenados', () => {
      const backups = [
        { timestamp: '2025-03-15T10:00:00.000Z', data: { fundsTransactions: [], clients: [] } },
      ];
      localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(backups));

      expect(getAutoBackups()).toHaveLength(1);
      expect(getAutoBackups()[0].timestamp).toBe('2025-03-15T10:00:00.000Z');
    });

    it('retorna array vazio quando dados estão corrompidos', () => {
      localStorage.setItem(AUTO_BACKUP_KEY, 'não é JSON válido {{{');
      expect(getAutoBackups()).toEqual([]);
    });
  });

  // ==================== createAutoBackup ====================

  describe('createAutoBackup', () => {
    it('cria o primeiro backup corretamente', () => {
      const funds = [{ id: 'f1', amount: 1000 }];
      const clients = [{ id: 'c1', name: 'Ana', loans: [] }];

      const result = createAutoBackup(funds, clients, 3);

      expect(result).toHaveLength(1);
      expect(result[0].data.fundsTransactions).toEqual(funds);
      expect(result[0].data.clients).toEqual(clients);
      expect(result[0].timestamp).toBeDefined();
    });

    it('adiciona novo backup no início da lista', () => {
      // Cria dois backups
      createAutoBackup([], [{ id: 'c1', name: 'Primeiro', loans: [] }], 3);
      const result = createAutoBackup([], [{ id: 'c2', name: 'Segundo', loans: [] }], 3);

      expect(result).toHaveLength(2);
      expect(result[0].data.clients[0].name).toBe('Segundo'); // mais recente primeiro
      expect(result[1].data.clients[0].name).toBe('Primeiro');
    });

    it('respeita o limite máximo de backups', () => {
      createAutoBackup([], [{ id: 'c1', name: 'B1', loans: [] }], 2);
      createAutoBackup([], [{ id: 'c2', name: 'B2', loans: [] }], 2);
      const result = createAutoBackup([], [{ id: 'c3', name: 'B3', loans: [] }], 2);

      expect(result).toHaveLength(2);
      expect(result[0].data.clients[0].name).toBe('B3'); // mais recente
      expect(result[1].data.clients[0].name).toBe('B2'); // segundo mais recente
      // B1 foi descartado (rotação FIFO)
    });

    it('persiste no localStorage', () => {
      createAutoBackup([], [{ id: 'c1', name: 'Test', loans: [] }], 3);

      const stored = JSON.parse(localStorage.getItem(AUTO_BACKUP_KEY));
      expect(stored).toHaveLength(1);
    });

    it('funciona com maxBackups = 1', () => {
      createAutoBackup([], [{ id: 'c1', name: 'A', loans: [] }], 1);
      const result = createAutoBackup([], [{ id: 'c2', name: 'B', loans: [] }], 1);

      expect(result).toHaveLength(1);
      expect(result[0].data.clients[0].name).toBe('B');
    });

    it('usa maxBackups padrão de 3 quando não especificado', () => {
      createAutoBackup([], [{ id: 'c1', name: 'A', loans: [] }]);
      createAutoBackup([], [{ id: 'c2', name: 'B', loans: [] }]);
      createAutoBackup([], [{ id: 'c3', name: 'C', loans: [] }]);
      const result = createAutoBackup([], [{ id: 'c4', name: 'D', loans: [] }]);

      expect(result).toHaveLength(3);
      expect(result[0].data.clients[0].name).toBe('D');
    });
  });

  // ==================== getLastAutoBackup ====================

  describe('getLastAutoBackup', () => {
    it('retorna null quando não há backups', () => {
      expect(getLastAutoBackup()).toBeNull();
    });

    it('retorna o backup mais recente', () => {
      createAutoBackup([], [{ id: 'c1', name: 'Antigo', loans: [] }], 3);
      createAutoBackup([], [{ id: 'c2', name: 'Recente', loans: [] }], 3);

      const last = getLastAutoBackup();

      expect(last).not.toBeNull();
      expect(last.data.clients[0].name).toBe('Recente');
    });
  });

  // ==================== restoreAutoBackup ====================

  describe('restoreAutoBackup', () => {
    it('retorna dados do backup no índice especificado', () => {
      createAutoBackup([{ id: 'f1', amount: 100 }], [{ id: 'c1', name: 'A', loans: [] }], 5);
      createAutoBackup([{ id: 'f2', amount: 200 }], [{ id: 'c2', name: 'B', loans: [] }], 5);

      // Índice 0 = mais recente (B)
      const latest = restoreAutoBackup(0);
      expect(latest.clients[0].name).toBe('B');

      // Índice 1 = anterior (A)
      const previous = restoreAutoBackup(1);
      expect(previous.clients[0].name).toBe('A');
    });

    it('retorna null para índice fora do range', () => {
      createAutoBackup([], [{ id: 'c1', name: 'A', loans: [] }], 3);

      expect(restoreAutoBackup(5)).toBeNull();
      expect(restoreAutoBackup(1)).toBeNull();
    });

    it('usa índice 0 por padrão', () => {
      createAutoBackup([], [{ id: 'c1', name: 'Único', loans: [] }], 3);

      const result = restoreAutoBackup();
      expect(result.clients[0].name).toBe('Único');
    });

    it('retorna null quando não há backups', () => {
      expect(restoreAutoBackup(0)).toBeNull();
    });
  });

  // ==================== getAutoBackupCount ====================

  describe('getAutoBackupCount', () => {
    it('retorna 0 quando não há backups', () => {
      expect(getAutoBackupCount()).toBe(0);
    });

    it('retorna contagem correta', () => {
      createAutoBackup([], [], 5);
      createAutoBackup([], [], 5);
      createAutoBackup([], [], 5);

      expect(getAutoBackupCount()).toBe(3);
    });

    it('contagem respeita o limite de rotação', () => {
      createAutoBackup([], [], 2);
      createAutoBackup([], [], 2);
      createAutoBackup([], [], 2);
      createAutoBackup([], [], 2);

      expect(getAutoBackupCount()).toBe(2);
    });
  });
});
