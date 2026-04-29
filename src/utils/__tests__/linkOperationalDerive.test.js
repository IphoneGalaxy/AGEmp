import { describe, it, expect } from 'vitest';
import {
  listOperationalLinkOptions,
  findOperationalLinkOption,
} from '../linkOperationalDerive';

const lcA = () => ({
  version: 1,
  linkId: 'lnk-a',
  supplierId: 'sup1',
  clientId: 'cli1',
  associatedAt: '2025-01-01T00:00:00.000Z',
});

describe('listOperationalLinkOptions', () => {
  it('retorna lista vazia para entrada inválida', () => {
    expect(listOperationalLinkOptions(undefined)).toEqual([]);
    expect(listOperationalLinkOptions(null)).toEqual([]);
  });

  it('agrega apenas client.linkContext por linkId', () => {
    const clients = [{ id: 'c1', name: 'x', loans: [], linkContext: lcA() }];
    const opts = listOperationalLinkOptions(clients);
    expect(opts).toHaveLength(1);
    expect(opts[0].linkId).toBe('lnk-a');
    expect(opts[0].clientCount).toBe(1);
    expect(opts[0].loanCount).toBe(0);
    expect(opts[0].paymentCount).toBe(0);
  });

  it('conta contratos e lançamentos de pagamento por loan.linkContext', () => {
    const clients = [
      {
        id: 'c1',
        name: 'x',
        loans: [],
        linkContext: null,
      },
      {
        id: 'c2',
        name: 'y',
        linkContext: null,
        loans: [
          {
            id: 'L1',
            linkContext: lcA(),
            payments: [{ id: 'p1' }, { id: 'p2' }],
          },
          {
            id: 'L2',
            linkContext: lcA(),
            payments: [],
          },
        ],
      },
    ];
    const opts = listOperationalLinkOptions(clients);
    expect(opts).toHaveLength(1);
    expect(opts[0].clientCount).toBe(0);
    expect(opts[0].loanCount).toBe(2);
    expect(opts[0].paymentCount).toBe(2);
  });

  it('mistura cliente e contrato para o mesmo linkId', () => {
    const clients = [
      {
        id: 'c1',
        linkContext: lcA(),
        loans: [{ id: 'L1', linkContext: lcA(), payments: [{ id: 'p1' }] }],
      },
    ];
    const opts = listOperationalLinkOptions(clients);
    expect(opts[0].clientCount).toBe(1);
    expect(opts[0].loanCount).toBe(1);
    expect(opts[0].paymentCount).toBe(1);
  });
});

describe('findOperationalLinkOption', () => {
  it('resolve opção pelo linkId', () => {
    const opts = [{ linkId: 'a', label: '', clientCount: 1, loanCount: 0, paymentCount: 0 }];
    expect(findOperationalLinkOption(opts, 'a')).toEqual(opts[0]);
    expect(findOperationalLinkOption(opts, '')).toBeNull();
  });
});
