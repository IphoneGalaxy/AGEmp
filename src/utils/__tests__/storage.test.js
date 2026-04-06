/**
 * Testes unitários para o módulo de persistência (storage.js).
 *
 * Cobertura:
 * - normalizeClients: migração v1 (transactions → loans), v2 (interestRate)
 * - loadData / saveData com localStorage
 * - parseBackupFile com dados válidos e inválidos
 * - Cenários de borda: arrays vazios, dados corrompidos, formatos antigos
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { normalizeClients, loadData, saveData, parseBackupFile } from '../storage';

// ==================== NORMALIZE CLIENTS ====================

describe('normalizeClients', () => {
  describe('cenários base', () => {
    it('retorna array vazio quando recebe array vazio', () => {
      expect(normalizeClients([])).toEqual([]);
    });

    it('retorna array vazio quando recebe null', () => {
      expect(normalizeClients(null)).toEqual([]);
    });

    it('retorna array vazio quando recebe undefined', () => {
      expect(normalizeClients(undefined)).toEqual([]);
    });

    it('retorna array vazio quando recebe tipo inválido (string)', () => {
      expect(normalizeClients('nao é array')).toEqual([]);
    });

    it('retorna array vazio quando recebe tipo inválido (número)', () => {
      expect(normalizeClients(42)).toEqual([]);
    });
  });

  describe('migração v1: transactions → loans', () => {
    it('converte formato antigo com transactions para loans', () => {
      const oldClient = {
        id: 'c1',
        name: 'Cliente Antigo',
        transactions: [
          { id: 't1', type: 'loan', date: '2024-01-10', amount: 1000 },
          { id: 't2', type: 'payment', date: '2024-02-10', amount: 200 },
        ],
      };
      const result = normalizeClients([oldClient]);

      expect(result[0].loans).toHaveLength(1);
      expect(result[0].loans[0].id).toBe('t1');
      expect(result[0].loans[0].amount).toBe(1000);
      expect(result[0].loans[0].interestRate).toBe(10); // default
      expect(result[0].loans[0].payments).toHaveLength(1);
      expect(result[0].loans[0].payments[0].id).toBe('t2');
    });

    it('atribui pagamentos ao primeiro empréstimo quando há múltiplos empréstimos antigos', () => {
      const oldClient = {
        id: 'c1',
        name: 'Multi Loan',
        transactions: [
          { id: 'l1', type: 'loan', date: '2024-01-10', amount: 500 },
          { id: 'l2', type: 'loan', date: '2024-03-10', amount: 800 },
          { id: 'p1', type: 'payment', date: '2024-02-10', amount: 100 },
        ],
      };
      const result = normalizeClients([oldClient]);

      expect(result[0].loans).toHaveLength(2);
      // Pagamentos atribuídos ao primeiro empréstimo (l1)
      expect(result[0].loans[0].payments).toHaveLength(1);
      expect(result[0].loans[1].payments).toHaveLength(0);
    });

    it('migração de transactions usa defaultRate customizado', () => {
      const oldClient = {
        id: 'c1',
        name: 'Taxa Custom',
        transactions: [
          { id: 'l1', type: 'loan', date: '2024-01-10', amount: 1000 },
        ],
      };
      const result = normalizeClients([oldClient], 8.5);

      expect(result[0].loans[0].interestRate).toBe(8.5);
    });

    it('migração ordena transações por data', () => {
      const oldClient = {
        id: 'c1',
        name: 'Ordem',
        transactions: [
          { id: 'l2', type: 'loan', date: '2024-06-01', amount: 200 },
          { id: 'l1', type: 'loan', date: '2024-01-01', amount: 500 },
        ],
      };
      const result = normalizeClients([oldClient]);

      // Empréstimos ordenados por data crescente
      expect(result[0].loans[0].id).toBe('l1');
      expect(result[0].loans[1].id).toBe('l2');
    });

    it('não aplica migração v1 se loans já existe', () => {
      const client = {
        id: 'c1',
        name: 'Novo',
        loans: [{ id: 'l1', date: '2025-01-01', amount: 1000, payments: [] }],
        transactions: [
          { id: 't1', type: 'loan', date: '2024-01-01', amount: 999 },
        ],
      };
      const result = normalizeClients([client]);

      // Deve manter loans existentes, não usar transactions
      expect(result[0].loans).toHaveLength(1);
      expect(result[0].loans[0].amount).toBe(1000);
    });
  });

  describe('migração v2: adiciona interestRate', () => {
    it('adiciona interestRate padrão (10%) em empréstimo sem taxa', () => {
      const client = {
        id: 'c1',
        name: 'Sem Taxa',
        loans: [{ id: 'l1', date: '2025-01-01', amount: 1000, payments: [] }],
      };
      const result = normalizeClients([client]);

      expect(result[0].loans[0].interestRate).toBe(10);
    });

    it('preserva interestRate existente', () => {
      const client = {
        id: 'c1',
        name: 'Com Taxa',
        loans: [
          { id: 'l1', date: '2025-01-01', amount: 1000, interestRate: 8.5, payments: [] },
        ],
      };
      const result = normalizeClients([client]);

      expect(result[0].loans[0].interestRate).toBe(8.5);
    });

    it('preserva interestRate = 0 (sem juros)', () => {
      const client = {
        id: 'c1',
        name: 'Zero',
        loans: [
          { id: 'l1', date: '2025-01-01', amount: 500, interestRate: 0, payments: [] },
        ],
      };
      const result = normalizeClients([client]);

      expect(result[0].loans[0].interestRate).toBe(0);
    });

    it('usa defaultRate customizado para empréstimos sem taxa', () => {
      const client = {
        id: 'c1',
        name: 'Custom',
        loans: [{ id: 'l1', date: '2025-01-01', amount: 1000, payments: [] }],
      };
      const result = normalizeClients([client], 7);

      expect(result[0].loans[0].interestRate).toBe(7);
    });

    it('garante que payments é array mesmo quando ausente', () => {
      const client = {
        id: 'c1',
        name: 'No Payments',
        loans: [{ id: 'l1', date: '2025-01-01', amount: 1000 }],
      };
      const result = normalizeClients([client]);

      expect(result[0].loans[0].payments).toEqual([]);
    });
  });

  describe('cliente sem loans nem transactions', () => {
    it('adiciona loans como array vazio', () => {
      const client = { id: 'c1', name: 'Vazio' };
      const result = normalizeClients([client]);

      expect(result[0].loans).toEqual([]);
    });
  });

  describe('múltiplos clientes mistos', () => {
    it('normaliza corretamente uma lista mista', () => {
      const clients = [
        {
          id: 'c1', name: 'Antigo',
          transactions: [
            { id: 't1', type: 'loan', date: '2024-01-01', amount: 500 },
          ],
        },
        {
          id: 'c2', name: 'Novo sem taxa',
          loans: [{ id: 'l1', date: '2025-02-01', amount: 800, payments: [] }],
        },
        {
          id: 'c3', name: 'Novo com taxa',
          loans: [
            { id: 'l2', date: '2025-03-01', amount: 1200, interestRate: 12, payments: [] },
          ],
        },
      ];
      const result = normalizeClients(clients);

      // c1: migrado de transactions
      expect(result[0].loans[0].interestRate).toBe(10);
      // c2: recebeu taxa padrão
      expect(result[1].loans[0].interestRate).toBe(10);
      // c3: manteve taxa
      expect(result[2].loans[0].interestRate).toBe(12);
    });
  });
});

// ==================== LOAD DATA / SAVE DATA ====================

describe('loadData / saveData', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('retorna null quando localStorage está vazio', () => {
    const result = loadData();
    expect(result).toBeNull();
  });

  it('carrega dados válidos e normaliza clientes', () => {
    const data = {
      fundsTransactions: [{ id: 'f1', date: '2025-01-01', amount: 5000 }],
      clients: [
        { id: 'c1', name: 'Ana', loans: [{ id: 'l1', date: '2025-01-01', amount: 1000, payments: [] }] },
      ],
    };
    localStorage.setItem('loanManagerData', JSON.stringify(data));

    const result = loadData();

    expect(result.fundsTransactions).toHaveLength(1);
    expect(result.clients).toHaveLength(1);
    expect(result.clients[0].loans[0].interestRate).toBe(10);
  });

  it('carrega dados com defaultRate customizado', () => {
    const data = {
      fundsTransactions: [],
      clients: [
        { id: 'c1', name: 'Ana', loans: [{ id: 'l1', date: '2025-01-01', amount: 1000, payments: [] }] },
      ],
    };
    localStorage.setItem('loanManagerData', JSON.stringify(data));

    const result = loadData(7);
    expect(result.clients[0].loans[0].interestRate).toBe(7);
  });

  it('retorna fundsTransactions vazio se ausente nos dados', () => {
    localStorage.setItem('loanManagerData', JSON.stringify({ clients: [] }));
    const result = loadData();

    expect(result.fundsTransactions).toEqual([]);
  });

  it('saveData persiste dados que loadData pode recuperar', () => {
    const funds = [{ id: 'f1', date: '2025-01-01', amount: 3000 }];
    const clients = [
      { id: 'c1', name: 'João', loans: [{ id: 'l1', date: '2025-01-01', amount: 500, interestRate: 8, payments: [] }] },
    ];

    saveData(funds, clients);
    const result = loadData();

    expect(result.fundsTransactions).toHaveLength(1);
    expect(result.fundsTransactions[0].amount).toBe(3000);
    expect(result.clients[0].loans[0].amount).toBe(500);
  });
});

// ==================== PARSE BACKUP FILE ====================

describe('parseBackupFile', () => {
  /** Helper: cria um File mock com conteúdo texto */
  const createMockFile = (content, name = 'backup.txt') => {
    return new File([content], name, { type: 'text/plain' });
  };

  it('resolve com dados válidos de backup', async () => {
    const data = { fundsTransactions: [], clients: [{ id: 'c1', name: 'Ana', loans: [] }] };
    const file = createMockFile(JSON.stringify(data));

    const result = await parseBackupFile(file);

    expect(result.clients).toHaveLength(1);
    expect(result.clients[0].name).toBe('Ana');
  });

  it('rejeita quando JSON é válido mas não tem campo clients', async () => {
    const file = createMockFile(JSON.stringify({ foo: 'bar' }));

    await expect(parseBackupFile(file)).rejects.toThrow('INVALID_BACKUP');
  });

  it('rejeita quando clients não é array', async () => {
    const file = createMockFile(JSON.stringify({ clients: 'not an array' }));

    await expect(parseBackupFile(file)).rejects.toThrow('INVALID_BACKUP');
  });

  it('rejeita quando conteúdo não é JSON válido', async () => {
    const file = createMockFile('isso não é json {{{');

    await expect(parseBackupFile(file)).rejects.toThrow('READ_ERROR');
  });

  it('aceita backup com fundsTransactions ausente', async () => {
    const data = { clients: [] };
    const file = createMockFile(JSON.stringify(data));

    const result = await parseBackupFile(file);
    expect(result.clients).toEqual([]);
  });

  it('aceita backup com dados de formato antigo (transactions)', async () => {
    const data = {
      clients: [{
        id: 'c1',
        name: 'Legado',
        transactions: [
          { id: 't1', type: 'loan', date: '2024-01-01', amount: 1000 },
        ],
      }],
    };
    const file = createMockFile(JSON.stringify(data));

    const result = await parseBackupFile(file);
    // parseBackupFile apenas valida, não normaliza
    expect(result.clients[0].transactions).toBeDefined();
  });
});
