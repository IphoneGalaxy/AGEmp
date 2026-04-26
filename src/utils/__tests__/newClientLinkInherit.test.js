import { describe, it, expect, vi } from 'vitest';
import { LINK_LIST_FILTER } from '../clientLinkListFilter';
import {
  isEligibleForLinkContextInheritOnCreate,
  getLinkContextTemplateForInheritFromClients,
  buildNewClientWithOptionalLinkContext,
} from '../newClientLinkInherit';

vi.mock('../linkContext.js', () => ({
  buildLocalLinkContext: (s, c) => ({
    version: 1,
    linkId: `${s}__${c}`,
    supplierId: s,
    clientId: c,
    associatedAt: '2026-04-25T12:00:00.000Z',
  }),
}));

describe('newClientLinkInherit', () => {
  it('elegibilidade: UNLINKED ou sem localLinkId nega', () => {
    expect(isEligibleForLinkContextInheritOnCreate(LINK_LIST_FILTER.UNLINKED, 'a__b')).toBe(false);
    expect(isEligibleForLinkContextInheritOnCreate(LINK_LIST_FILTER.ALL, '')).toBe(false);
  });

  it('elegibilidade: ALL + linkId ativo permite', () => {
    expect(isEligibleForLinkContextInheritOnCreate(LINK_LIST_FILTER.ALL, 'a__b')).toBe(true);
  });

  it('template: encontra primeiro cliente com linkId', () => {
    const clients = [
      { id: '1', linkContext: { linkId: 'x', supplierId: 's1', clientId: 'c1' } },
      { id: '2', linkContext: { linkId: 'y', supplierId: 's2', clientId: 'c2' } },
    ];
    const t = getLinkContextTemplateForInheritFromClients(
      clients,
      LINK_LIST_FILTER.ALL,
      'y'
    );
    expect(t?.supplierId).toBe('s2');
  });

  it('buildNewClient: sem include mantém base', () => {
    const c = buildNewClientWithOptionalLinkContext({
      id: 'a',
      name: 'N',
      loans: [],
      includeLinkContext: false,
      templateLinkContext: { supplierId: 's', clientId: 'c', linkId: 's__c' },
    });
    expect(c).toEqual({ id: 'a', name: 'N', loans: [] });
  });

  it('buildNewClient: com include aplica buildLocalLinkContext (mockado)', () => {
    const c = buildNewClientWithOptionalLinkContext({
      id: 'a',
      name: 'N',
      loans: [],
      includeLinkContext: true,
      templateLinkContext: { supplierId: 's', clientId: 'c' },
    });
    expect(c.linkContext).toMatchObject({ supplierId: 's', clientId: 'c', linkId: 's__c' });
  });
});
