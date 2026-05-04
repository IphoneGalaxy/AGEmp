import { describe, expect, it, vi, afterEach } from 'vitest';

import {
  SUPPLIER_UNREAD_PENDING_MAX_AGE_SEC,
  countUnreadLoanRequests,
  firestoreTimestampSecondsOrNull,
  getClientEventSecondsForSupplierBadge,
  getSupplierEventSecondsForClientBadge,
} from '../loanRequestUnreadCount';

const CLIENT = 'client-uid';
const SUPPLIER = 'supplier-uid';

describe('firestoreTimestampSecondsOrNull', () => {
  it('retorna null para valores inválidos', () => {
    expect(firestoreTimestampSecondsOrNull(null)).toBeNull();
    expect(firestoreTimestampSecondsOrNull(undefined)).toBeNull();
    expect(firestoreTimestampSecondsOrNull('x')).toBeNull();
    expect(firestoreTimestampSecondsOrNull({})).toBeNull();
  });

  it('aceita seconds', () => {
    expect(firestoreTimestampSecondsOrNull({ seconds: 1700 })).toBe(1700);
  });

  it('aceita _seconds', () => {
    expect(firestoreTimestampSecondsOrNull({ _seconds: 1800 })).toBe(1800);
  });

  it('aceita toMillis()', () => {
    expect(firestoreTimestampSecondsOrNull({ toMillis: () => 5_005_000 })).toBe(5005);
  });

  it('aceita número como segundos', () => {
    expect(firestoreTimestampSecondsOrNull(1999)).toBe(1999);
  });

  it('ignora toMillis que lança', () => {
    expect(
      firestoreTimestampSecondsOrNull({
        toMillis: () => {
          throw new Error('x');
        },
      }),
    ).toBeNull();
  });
});

describe('getSupplierEventSecondsForClientBadge / getClientEventSecondsForSupplierBadge', () => {
  it('pending não gera evento de fornecedor para o cliente', () => {
    expect(getSupplierEventSecondsForClientBadge({ status: 'pending', updatedAt: { seconds: 9 } })).toBeNull();
  });
});

describe('countUnreadLoanRequests', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lista vazia retorna 0', () => {
    expect(countUnreadLoanRequests([], CLIENT, 'client')).toBe(0);
  });

  it('não-array retorna 0', () => {
    expect(countUnreadLoanRequests(null, CLIENT, 'client')).toBe(0);
    expect(countUnreadLoanRequests(undefined, CLIENT, 'client')).toBe(0);
  });

  it('uid ausente retorna 0', () => {
    const row = { clientId: CLIENT, status: 'counteroffer', counterofferedAt: { seconds: 1 } };
    expect(countUnreadLoanRequests([row], '', 'client')).toBe(0);
    expect(countUnreadLoanRequests([row], null, 'client')).toBe(0);
    expect(countUnreadLoanRequests([row], undefined, 'client')).toBe(0);
  });

  it('role inválido retorna 0', () => {
    expect(countUnreadLoanRequests([{ clientId: CLIENT, status: 'pending' }], CLIENT, 'admin')).toBe(0);
  });

  it('request de outro usuário não entra', () => {
    expect(
      countUnreadLoanRequests(
        [{ clientId: 'other', supplierId: SUPPLIER, status: 'counteroffer', counterofferedAt: { seconds: 10 }, updatedAt: { seconds: 10 } }],
        CLIENT,
        'client',
      ),
    ).toBe(0);
    expect(
      countUnreadLoanRequests(
        [{ clientId: CLIENT, supplierId: 'other', status: 'pending', createdAt: { seconds: 1 } }],
        SUPPLIER,
        'supplier',
      ),
    ).toBe(0);
  });

  it('ignora itens null ou não-objeto', () => {
    expect(countUnreadLoanRequests([null, 1, 'x', { clientId: CLIENT, status: 'pending' }], CLIENT, 'client')).toBe(0);
  });

  it('fornecedor vê 1 pedido pending novo (janela 14 dias)', () => {
    const nowSec = 1_700_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(nowSec * 1000);
    const createdSec = nowSec - 3600;
    expect(
      countUnreadLoanRequests(
        [{ supplierId: SUPPLIER, clientId: CLIENT, status: 'pending', createdAt: { seconds: createdSec } }],
        SUPPLIER,
        'supplier',
      ),
    ).toBe(1);
  });

  it('fornecedor não conta pending fora da janela', () => {
    const nowSec = 1_700_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(nowSec * 1000);
    const createdSec = nowSec - SUPPLIER_UNREAD_PENDING_MAX_AGE_SEC - 1;
    expect(
      countUnreadLoanRequests(
        [{ supplierId: SUPPLIER, clientId: CLIENT, status: 'pending', createdAt: { seconds: createdSec } }],
        SUPPLIER,
        'supplier',
      ),
    ).toBe(0);
  });

  it('cliente não conta pending próprio', () => {
    expect(
      countUnreadLoanRequests(
        [{ clientId: CLIENT, supplierId: SUPPLIER, status: 'pending', createdAt: { seconds: 1 } }],
        CLIENT,
        'client',
      ),
    ).toBe(0);
  });

  it('cliente conta counteroffer mais recente que readByClientAt', () => {
    expect(
      countUnreadLoanRequests(
        [
          {
            clientId: CLIENT,
            supplierId: SUPPLIER,
            status: 'counteroffer',
            counterofferedAt: { toMillis: () => 10_000 * 1000 },
            updatedAt: { _seconds: 9000 },
            readByClientAt: { seconds: 5000 },
          },
        ],
        CLIENT,
        'client',
      ),
    ).toBe(1);
  });

  it('cliente não conta counteroffer já lido', () => {
    expect(
      countUnreadLoanRequests(
        [
          {
            clientId: CLIENT,
            supplierId: SUPPLIER,
            status: 'counteroffer',
            counterofferedAt: { seconds: 100 },
            updatedAt: { seconds: 100 },
            readByClientAt: { seconds: 500 },
          },
        ],
        CLIENT,
        'client',
      ),
    ).toBe(0);
  });

  it('fornecedor conta evento do cliente mais recente que readBySupplierAt', () => {
    expect(
      countUnreadLoanRequests(
        [
          {
            supplierId: SUPPLIER,
            clientId: CLIENT,
            status: 'cancelled_by_client',
            createdAt: { seconds: 100 },
            cancelledAt: { seconds: 2000 },
            readBySupplierAt: { seconds: 1000 },
          },
        ],
        SUPPLIER,
        'supplier',
      ),
    ).toBe(1);
  });

  it('fornecedor: under_review sem readBy não conta (evita Novo eterno)', () => {
    expect(
      countUnreadLoanRequests(
        [
          {
            supplierId: SUPPLIER,
            clientId: CLIENT,
            status: 'under_review',
            createdAt: { seconds: 1 },
            updatedAt: { seconds: 2 },
          },
        ],
        SUPPLIER,
        'supplier',
      ),
    ).toBe(0);
  });

  it('pedido terminal legado sem readByClientAt não gera falso positivo (cliente)', () => {
    expect(
      countUnreadLoanRequests(
        [
          {
            clientId: CLIENT,
            supplierId: SUPPLIER,
            status: 'approved',
            respondedAt: { seconds: 500 },
            updatedAt: { seconds: 500 },
            requestedAmount: 100,
            approvedAmount: 100,
            // sem readByClientAt
          },
        ],
        CLIENT,
        'client',
      ),
    ).toBe(0);
  });

  it('pedido terminal sem readBySupplierAt não gera falso positivo (fornecedor)', () => {
    expect(
      countUnreadLoanRequests(
        [
          {
            supplierId: SUPPLIER,
            clientId: CLIENT,
            status: 'approved',
            createdAt: { seconds: 1 },
            respondedAt: { seconds: 2 },
            requestedAmount: 100,
            approvedAmount: 100,
          },
        ],
        SUPPLIER,
        'supplier',
      ),
    ).toBe(0);
  });

  it('timestamp numérico em campos principais funciona no fluxo fornecedor', () => {
    const nowSec = 1_700_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(nowSec * 1000);
    const createdSec = nowSec - 60;
    expect(
      countUnreadLoanRequests(
        [{ supplierId: SUPPLIER, clientId: CLIENT, status: 'pending', createdAt: createdSec }],
        SUPPLIER,
        'supplier',
      ),
    ).toBe(1);
  });

  it('getClientEventSecondsForSupplierBadge usa approved via contraproposta com timestamps mistos', () => {
    const sec = getClientEventSecondsForSupplierBadge({
      status: 'approved',
      createdAt: { seconds: 1 },
      requestedAmount: 1000,
      approvedAmount: 500,
      respondedAt: 9999,
      updatedAt: { toMillis: () => 8888 * 1000 },
    });
    expect(sec).toBe(9999);
  });
});
