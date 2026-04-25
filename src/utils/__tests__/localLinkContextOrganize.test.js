import { describe, it, expect } from 'vitest';
import {
  maskUidForLocalLabel,
  formatLocalVinculoLineFromContext,
  listDistinctLocalLinkOptions,
  filterClientsByLocalLinkId,
  countClientsWithLinkContext,
} from '../localLinkContextOrganize';

describe('localLinkContextOrganize', () => {
  it('mascaramento encurta UID longo', () => {
    expect(maskUidForLocalLabel('abc')).toBe('abc');
    expect(maskUidForLocalLabel('abcdefghijk')).toBe('abcd…hijk');
  });

  it('formatLocalVinculoLineFromContext usa supplier e client', () => {
    const line = formatLocalVinculoLineFromContext({
      linkId: 'a__b',
      supplierId: 'supplierUidLongerThanEight',
      clientId: 'clientX',
    });
    expect(line).toContain('Par:');
    expect(line).toContain('·');
  });

  it('listDistinctLocalLinkOptions agrega e ordena', () => {
    const clients = [
      { id: '1', name: 'A', linkContext: { linkId: 'z__1', supplierId: 'z', clientId: '1' } },
      { id: '2', name: 'B', linkContext: { linkId: 'a__2', supplierId: 'a', clientId: '2' } },
      { id: '3', name: 'C', linkContext: { linkId: 'a__2', supplierId: 'a', clientId: '2' } },
    ];
    const opts = listDistinctLocalLinkOptions(clients);
    expect(opts).toHaveLength(2);
    expect(opts[0].linkId).toBe('a__2');
    expect(opts[0].count).toBe(2);
    expect(opts[1].linkId).toBe('z__1');
  });

  it('filterClientsByLocalLinkId sem id devolve tudo', () => {
    const clients = [{ id: '1', linkContext: { linkId: 'x' } }, { id: '2' }];
    expect(filterClientsByLocalLinkId(clients, '')).toEqual(clients);
  });

  it('filterClientsByLocalLinkId filtra por linkId', () => {
    const clients = [
      { id: '1', linkContext: { linkId: 'a' } },
      { id: '2', linkContext: { linkId: 'b' } },
    ];
    const r = filterClientsByLocalLinkId(clients, 'a');
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('1');
  });

  it('countClientsWithLinkContext', () => {
    expect(
      countClientsWithLinkContext([
        { linkContext: {} },
        { linkContext: null },
        { id: 'x' },
      ])
    ).toBe(1);
  });
});
