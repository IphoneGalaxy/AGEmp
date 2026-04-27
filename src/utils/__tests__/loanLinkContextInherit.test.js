import { describe, it, expect, vi } from 'vitest';
import {
  canInheritLinkContextToLoan,
  buildLoanLinkContextFromClient,
  buildLoanWithOptionalLinkContext,
} from '../loanLinkContextInherit';

vi.mock('../linkContext.js', () => ({
  buildLocalLinkContext: (supplierId, clientId) => ({
    version: 1,
    linkId: `${supplierId}__${clientId}`,
    supplierId,
    clientId,
    associatedAt: '2026-04-26T12:00:00.000Z',
  }),
}));

describe('loanLinkContextInherit', () => {
  const clientLinkContext = {
    version: 1,
    linkId: 'supplier-1__client-1',
    supplierId: 'supplier-1',
    clientId: 'client-1',
    associatedAt: '2026-04-25T12:00:00.000Z',
  };

  const baseLoan = {
    id: 'loan-1',
    date: '2026-04-26',
    amount: 1000,
    interestRate: 10,
    payments: [],
  };

  it('canInheritLinkContextToLoan valida supplierId e clientId', () => {
    expect(canInheritLinkContextToLoan(clientLinkContext)).toBe(true);
    expect(canInheritLinkContextToLoan(null)).toBe(false);
    expect(canInheritLinkContextToLoan({ supplierId: 'supplier-1' })).toBe(false);
    expect(canInheritLinkContextToLoan({ clientId: 'client-1' })).toBe(false);
  });

  it('buildLoanLinkContextFromClient cria linkContext novo para o contrato', () => {
    const result = buildLoanLinkContextFromClient(clientLinkContext);

    expect(result).toEqual({
      version: 1,
      linkId: 'supplier-1__client-1',
      supplierId: 'supplier-1',
      clientId: 'client-1',
      associatedAt: '2026-04-26T12:00:00.000Z',
    });
  });

  it('buildLoanWithOptionalLinkContext preserva o contrato sem herança', () => {
    const result = buildLoanWithOptionalLinkContext({
      loan: baseLoan,
      clientLinkContext,
      includeLinkContext: false,
    });

    expect(result).toEqual(baseLoan);
    expect(result).not.toBe(baseLoan);
  });

  it('buildLoanWithOptionalLinkContext adiciona linkContext quando solicitado', () => {
    const result = buildLoanWithOptionalLinkContext({
      loan: baseLoan,
      clientLinkContext,
      includeLinkContext: true,
    });

    expect(result).toMatchObject(baseLoan);
    expect(result.linkContext).toMatchObject({
      version: 1,
      linkId: 'supplier-1__client-1',
      supplierId: 'supplier-1',
      clientId: 'client-1',
    });
  });

  it('buildLoanWithOptionalLinkContext ignora contexto inválido com segurança', () => {
    const result = buildLoanWithOptionalLinkContext({
      loan: baseLoan,
      clientLinkContext: { supplierId: 'supplier-1' },
      includeLinkContext: true,
    });

    expect(result).toEqual(baseLoan);
    expect(result.linkContext).toBeUndefined();
  });
});
