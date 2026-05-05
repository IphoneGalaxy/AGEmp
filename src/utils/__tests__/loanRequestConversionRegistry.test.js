import { describe, it, expect } from 'vitest';
import {
  normalizeLoanRequestConversionRegistry,
  upsertLoanRequestConversionRegistryEntry,
  findLoanRequestConversionRegistryEntry,
  hasHistoricalLoanRequestConversionWithoutLiveLoan,
} from '../loanRequestConversionRegistry';

describe('loanRequestConversionRegistry', () => {
  it('normalizeLoanRequestConversionRegistry descarta inválidos', () => {
    expect(normalizeLoanRequestConversionRegistry(null)).toEqual([]);
    expect(
      normalizeLoanRequestConversionRegistry([
        {
          loanRequestId: 'a',
          convertedAt: 'x',
          supplierId: 's',
          clientId: 'c',
          localClientId: 'lc',
          localLoanId: 'll',
        },
        { foo: 1 },
      ]),
    ).toHaveLength(1);
  });

  it('upsert substitui mesmo loanRequestId', () => {
    const next = upsertLoanRequestConversionRegistryEntry(
      [
        {
          loanRequestId: 'r1',
          convertedAt: 't1',
          supplierId: 's',
          clientId: 'c',
          localClientId: 'x',
          localLoanId: 'y',
        },
      ],
      {
        loanRequestId: 'r1',
        convertedAt: 't2',
        supplierId: 's',
        clientId: 'c',
        localClientId: 'z',
        localLoanId: 'w',
      },
    );
    expect(next).toHaveLength(1);
    expect(next[0].convertedAt).toBe('t2');
    expect(next[0].localClientId).toBe('z');
  });

  it('findLoanRequestConversionRegistryEntry', () => {
    const row = findLoanRequestConversionRegistryEntry(
      [
        {
          loanRequestId: 'abc',
          convertedAt: 'z',
          supplierId: 's',
          clientId: 'c',
          localClientId: 'lc',
          localLoanId: 'll',
        },
      ],
      'abc',
    );
    expect(row?.loanRequestId).toBe('abc');
    expect(findLoanRequestConversionRegistryEntry([], 'abc')).toBeUndefined();
  });

  it('hasHistoricalLoanRequestConversionWithoutLiveLoan', () => {
    const registry = [
      {
        loanRequestId: 'lr1',
        convertedAt: 'z',
        supplierId: 's',
        clientId: 'c',
        localClientId: 'lc',
        localLoanId: 'll',
      },
    ];
    expect(
      hasHistoricalLoanRequestConversionWithoutLiveLoan(
        registry,
        [],
        'lr1',
        () => false,
      ),
    ).toBe(true);
    expect(
      hasHistoricalLoanRequestConversionWithoutLiveLoan(
        registry,
        [],
        'lr1',
        () => true,
      ),
    ).toBe(false);
    expect(
      hasHistoricalLoanRequestConversionWithoutLiveLoan([], [], 'lr1', () => false),
    ).toBe(false);
  });
});
