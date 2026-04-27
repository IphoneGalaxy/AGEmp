import { describe, it, expect } from 'vitest';
import {
  LOAN_LINK_LIST_FILTER,
  filterLoansByLinkContextPresence,
  countLoansWithLinkContext,
  countLoansWithoutLinkContext,
  shouldShowLoanLinkContextFilter,
} from '../loanLinkContextFilter';

describe('loanLinkContextFilter', () => {
  const loans = [
    { id: '1', linkContext: { linkId: 'a__b' } },
    { id: '2' },
    { id: '3', linkContext: null },
  ];

  it('ALL retorna a lista', () => {
    expect(filterLoansByLinkContextPresence(loans, LOAN_LINK_LIST_FILTER.ALL)).toEqual(loans);
  });

  it('retorna vazio se entrada inválida', () => {
    expect(filterLoansByLinkContextPresence(null, LOAN_LINK_LIST_FILTER.ALL)).toEqual([]);
  });

  it('LINKED filtra com linkContext truthy', () => {
    const r = filterLoansByLinkContextPresence(loans, LOAN_LINK_LIST_FILTER.LINKED);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('1');
  });

  it('UNLINKED inclui sem linkContext e com null', () => {
    const r = filterLoansByLinkContextPresence(loans, LOAN_LINK_LIST_FILTER.UNLINKED);
    expect(r.map((l) => l.id).sort()).toEqual(['2', '3']);
  });

  it('contagens', () => {
    expect(countLoansWithLinkContext(loans)).toBe(1);
    expect(countLoansWithoutLinkContext(loans)).toBe(2);
  });

  it('shouldShowLoanLinkContextFilter: vazio = false', () => {
    expect(shouldShowLoanLinkContextFilter([])).toBe(false);
  });

  it('shouldShowLoanLinkContextFilter: 1 sem anotação = false', () => {
    expect(shouldShowLoanLinkContextFilter([{ id: 'a' }])).toBe(false);
  });

  it('shouldShowLoanLinkContextFilter: 1 com anotação = true', () => {
    expect(shouldShowLoanLinkContextFilter([{ id: 'a', linkContext: { x: 1 } }])).toBe(true);
  });

  it('shouldShowLoanLinkContextFilter: 2+ = true', () => {
    expect(shouldShowLoanLinkContextFilter([{ id: 'a' }, { id: 'b' }])).toBe(true);
  });
});
