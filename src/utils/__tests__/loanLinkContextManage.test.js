import { describe, it, expect, vi } from 'vitest';
import {
  canAnnotateLoanFromClientContext,
  annotateLoanFromClientContext,
  removeLoanLinkContext,
  getLoanLinkContextActionState,
} from '../loanLinkContextManage.js';

vi.mock('../linkContext.js', () => ({
  buildLocalLinkContext: (supplierId, clientId) => ({
    version: 1,
    linkId: `${supplierId}__${clientId}`,
    supplierId,
    clientId,
    associatedAt: '2026-04-27T12:00:00.000Z',
  }),
}));

const validClientCtx = {
  version: 1,
  linkId: 'a__b',
  supplierId: 'a',
  clientId: 'b',
  associatedAt: '2026-01-01T00:00:00.000Z',
};

describe('loanLinkContextManage', () => {
  const baseLoan = {
    id: 'L1',
    date: '2026-04-20',
    amount: 100,
    interestRate: 10,
    payments: [{ id: 'p1', amount: 10, date: '2026-04-20' }],
  };

  it('canAnnotateLoanFromClientContext: exige contrato sem anotação e contexto de cliente válido', () => {
    expect(canAnnotateLoanFromClientContext(baseLoan, validClientCtx)).toBe(true);
    expect(
      canAnnotateLoanFromClientContext({ ...baseLoan, linkContext: { x: 1 } }, validClientCtx)
    ).toBe(false);
    expect(canAnnotateLoanFromClientContext(baseLoan, { supplierId: 'a' })).toBe(false);
    expect(canAnnotateLoanFromClientContext(null, validClientCtx)).toBe(false);
  });

  it('annotateLoanFromClientContext: adiciona snapshot e preserva campos financeiros', () => {
    const next = annotateLoanFromClientContext(baseLoan, validClientCtx);
    expect(next).not.toBe(baseLoan);
    expect(next.payments).toEqual(baseLoan.payments);
    expect(next.amount).toBe(100);
    expect(next.linkContext).toMatchObject({
      version: 1,
      linkId: 'a__b',
      supplierId: 'a',
      clientId: 'b',
      associatedAt: '2026-04-27T12:00:00.000Z',
    });
  });

  it('annotateLoanFromClientContext: não sobrescreve anotação existente', () => {
    const existing = { ...baseLoan, linkContext: { version: 1, linkId: 'old' } };
    const next = annotateLoanFromClientContext(existing, validClientCtx);
    expect(next).toBe(existing);
    expect(next.linkContext.linkId).toBe('old');
  });

  it('removeLoanLinkContext: remove metadado e mantém o resto', () => {
    const withCtx = { ...baseLoan, linkContext: { version: 1, linkId: 'x' } };
    const next = removeLoanLinkContext(withCtx);
    expect(next.linkContext).toBeUndefined();
    expect(next.payments).toEqual(baseLoan.payments);
    expect(next.id).toBe('L1');
  });

  it('removeLoanLinkContext: no-op se já sem linkContext', () => {
    const next = removeLoanLinkContext(baseLoan);
    expect(next).toBe(baseLoan);
  });

  it('getLoanLinkContextActionState', () => {
    expect(getLoanLinkContextActionState(baseLoan, validClientCtx)).toEqual({
      canAdd: true,
      canRemove: false,
    });
    expect(
      getLoanLinkContextActionState({ ...baseLoan, linkContext: { x: 1 } }, validClientCtx)
    ).toEqual({
      canAdd: false,
      canRemove: true,
    });
  });
});
