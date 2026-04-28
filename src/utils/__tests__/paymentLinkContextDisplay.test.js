import { describe, it, expect } from 'vitest';
import { getLoanLinkContextForPaymentDisplay } from '../paymentLinkContextDisplay';

describe('paymentLinkContextDisplay', () => {
  const lc = {
    version: 1,
    linkId: 'a__b',
    supplierId: 'a',
    clientId: 'b',
    associatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('retorna linkContext do contrato quando existe', () => {
    const loan = { id: 'L1', amount: 100, linkContext: lc };
    expect(getLoanLinkContextForPaymentDisplay(loan)).toEqual(lc);
  });

  it('retorna null quando contrato sem linkContext', () => {
    expect(getLoanLinkContextForPaymentDisplay({ id: 'L1', payments: [] })).toBeNull();
  });

  it('retorna null quando linkContext é null', () => {
    expect(getLoanLinkContextForPaymentDisplay({ id: 'L1', linkContext: null })).toBeNull();
  });

  it('retorna null quando loan inválido', () => {
    expect(getLoanLinkContextForPaymentDisplay(null)).toBeNull();
  });

  it('não considera client.linkContext (util só recebe loan)', () => {
    const loan = { id: 'L1', payments: [] };
    expect(getLoanLinkContextForPaymentDisplay(loan)).toBeNull();
  });
});
