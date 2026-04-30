import { describe, expect, it } from 'vitest';
import {
  LOAN_LINK_CONTEXT_RELATION,
  classifyLoanLinkContextRelation,
  summarizeClientLoanLinkContext,
} from '../clientLoanLinkContextSummary';

const linkA = () => ({ linkId: 'link-a', supplierId: 'sup-a', clientId: 'cli-a' });
const linkB = () => ({ linkId: 'link-b', supplierId: 'sup-b', clientId: 'cli-b' });

describe('clientLoanLinkContextSummary', () => {
  it('classifica contrato sem anotação', () => {
    expect(classifyLoanLinkContextRelation({ id: 'loan-1' }, linkA())).toBe(
      LOAN_LINK_CONTEXT_RELATION.UNLINKED
    );
  });

  it('classifica contrato alinhado ao vínculo do cliente', () => {
    expect(classifyLoanLinkContextRelation({ linkContext: linkA() }, linkA())).toBe(
      LOAN_LINK_CONTEXT_RELATION.SAME_AS_CLIENT
    );
  });

  it('classifica contrato com vínculo diferente do cliente', () => {
    expect(classifyLoanLinkContextRelation({ linkContext: linkB() }, linkA())).toBe(
      LOAN_LINK_CONTEXT_RELATION.DIFFERENT_FROM_CLIENT
    );
  });

  it('classifica contrato anotado quando cliente não tem anotação', () => {
    expect(classifyLoanLinkContextRelation({ linkContext: linkA() }, null)).toBe(
      LOAN_LINK_CONTEXT_RELATION.LINKED_WITHOUT_CLIENT
    );
  });

  it('resume contratos por relação operacional local', () => {
    const summary = summarizeClientLoanLinkContext(linkA(), [
      { id: '1', linkContext: linkA() },
      { id: '2', linkContext: linkB() },
      { id: '3' },
      { id: '4', linkContext: linkA() },
    ]);

    expect(summary).toEqual({
      total: 4,
      sameAsClient: 2,
      differentFromClient: 1,
      linkedWithoutClient: 0,
      unlinked: 1,
      linked: 3,
    });
  });

  it('trata lista inválida como vazia', () => {
    expect(summarizeClientLoanLinkContext(linkA(), null)).toEqual({
      total: 0,
      sameAsClient: 0,
      differentFromClient: 0,
      linkedWithoutClient: 0,
      unlinked: 0,
      linked: 0,
    });
  });
});
