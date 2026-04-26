import { describe, it, expect, vi } from 'vitest';
import { LINK_LIST_FILTER } from '../clientLinkListFilter';
import {
  isBatchLinkAnnotateEligible,
  isTemplateConsistentWithLinkId,
  applyLinkContextToClientsBatch,
  removeLinkContextFromClientsBatch,
} from '../clientLinkContextBatch';

vi.mock('../linkContext.js', () => {
  let n = 0;
  return {
    buildLocalLinkContext: (s, c) => {
      n += 1;
      return {
        version: 1,
        linkId: `${s}__${c}`,
        supplierId: s,
        clientId: c,
        associatedAt: `2026-04-25T12:00:00.${String(n).padStart(3, '0')}Z`,
      };
    },
  };
});

describe('clientLinkContextBatch', () => {
  it('isBatchLinkAnnotateEligible: exige linkId e não UNLINKED', () => {
    expect(isBatchLinkAnnotateEligible(LINK_LIST_FILTER.UNLINKED, 'a__b')).toBe(false);
    expect(isBatchLinkAnnotateEligible(LINK_LIST_FILTER.ALL, '')).toBe(false);
    expect(isBatchLinkAnnotateEligible(LINK_LIST_FILTER.ALL, 'a__b')).toBe(true);
  });

  it('isTemplateConsistentWithLinkId', () => {
    expect(isTemplateConsistentWithLinkId('s', 'c', 's__c')).toBe(true);
    expect(isTemplateConsistentWithLinkId('s', 'c', 'x__y')).toBe(false);
  });

  it('apply: anota só quem não tem; iguala mesmo vínculo; pula outro vínculo', () => {
    const allClients = [
      { id: '1', name: 'A', loans: [] },
      { id: '2', name: 'B', loans: [], linkContext: { linkId: 's__c', version: 1 } },
      { id: '3', name: 'C', loans: [], linkContext: { linkId: 'x__y', version: 1 } },
    ];
    const { nextClients, applied, alreadySame, skippedOther } = applyLinkContextToClientsBatch({
      allClients,
      selectedIds: ['1', '2', '3'],
      targetSupplierId: 's',
      targetClientId: 'c',
    });
    expect(applied).toBe(1);
    expect(alreadySame).toBe(1);
    expect(skippedOther).toBe(1);
    expect(nextClients[0].linkContext?.linkId).toBe('s__c');
    expect(nextClients[1].linkContext?.linkId).toBe('s__c');
    expect(nextClients[2].linkContext?.linkId).toBe('x__y');
  });

  it('remove: só remove linkContext dos selecionados', () => {
    const allClients = [
      { id: '1', name: 'A', linkContext: { linkId: 'a' } },
      { id: '2', name: 'B' },
    ];
    const { nextClients, removed, hadNone } = removeLinkContextFromClientsBatch({
      allClients,
      selectedIds: ['1', '2'],
    });
    expect(removed).toBe(1);
    expect(hadNone).toBe(1);
    expect(nextClients[0].linkContext).toBeUndefined();
    expect(nextClients[1]).toEqual({ id: '2', name: 'B' });
  });
});
