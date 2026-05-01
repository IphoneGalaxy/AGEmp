import { describe, expect, it } from 'vitest';

import { parseBrlMoneyInputToCents, normalizeNoteForLoanRequest } from '../brlMoneyInput';

describe('brlMoneyInput', () => {
  it('converte formato brasileiro com vírgula', () => {
    const r = parseBrlMoneyInputToCents('100,50');
    expect(r).toEqual({ ok: true, cents: 10050 });
  });

  it('rejeita valor abaixo do mínimo', () => {
    const r = parseBrlMoneyInputToCents('0', { minCents: 1, maxCents: 9999999999 });
    expect(r.ok).toBe(false);
  });

  it('normaliza nota e limita tamanho', () => {
    expect(normalizeNoteForLoanRequest('  a  ', 1000)).toBe('a');
    expect(normalizeNoteForLoanRequest('x'.repeat(1002), 1000).length).toBe(1000);
  });
});
