import { describe, it, expect } from 'vitest';
import {
  filterClientsByLinkContextPresence,
  LINK_LIST_FILTER,
} from '../clientLinkListFilter';

describe('clientLinkListFilter', () => {
  const clients = [
    { id: '1', name: 'A', linkContext: { version: 1, linkId: 'x' } },
    { id: '2', name: 'B' },
    { id: '3', name: 'C', linkContext: null },
  ];

  it('retorna vazio para entrada inválida', () => {
    expect(filterClientsByLinkContextPresence(null, LINK_LIST_FILTER.ALL)).toEqual([]);
  });

  it('ALL retorna a lista inteira', () => {
    expect(filterClientsByLinkContextPresence(clients, LINK_LIST_FILTER.ALL)).toEqual(clients);
  });

  it('LINKED filtra quem tem linkContext truthy', () => {
    const r = filterClientsByLinkContextPresence(clients, LINK_LIST_FILTER.LINKED);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('1');
  });

  it('UNLINKED inclui sem linkContext e com linkContext null', () => {
    const r = filterClientsByLinkContextPresence(clients, LINK_LIST_FILTER.UNLINKED);
    expect(r.map((c) => c.id).sort()).toEqual(['2', '3']);
  });
});
