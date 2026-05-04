import { describe, it, expect } from 'vitest';
import {
  DISPLAY_NAME_SNAPSHOT_MAX_LEN,
  normalizeDisplayNameForSnapshot,
  isValidDisplayNameSnapshot,
  resolveDisplayNameWithFallback,
  deriveLoanRequestClientFriendlyName,
  deriveLoanRequestSupplierFriendlyName,
  pickSnapshotFields,
  normalizeSnapshotPatch,
  buildDisplayNameSnapshotsPartial,
} from '../displayNameSnapshots';
import {
  NEW_LOCAL_CLIENT_NAME_FROM_PLATFORM_LOAN_REQUEST,
  PLATFORM_SUPPLIER_DISPLAY_FALLBACK,
} from '../platformFriendlyLabels';

describe('normalizeDisplayNameForSnapshot', () => {
  it('null, undefined, objeto e número viram null', () => {
    expect(normalizeDisplayNameForSnapshot(null)).toBe(null);
    expect(normalizeDisplayNameForSnapshot(undefined)).toBe(null);
    expect(normalizeDisplayNameForSnapshot({})).toBe(null);
    expect(normalizeDisplayNameForSnapshot(42)).toBe(null);
  });

  it('string vazia ou só espaços vira null', () => {
    expect(normalizeDisplayNameForSnapshot('')).toBe(null);
    expect(normalizeDisplayNameForSnapshot('   \t')).toBe(null);
  });

  it('string normal fica trimada', () => {
    expect(normalizeDisplayNameForSnapshot('  Ana  ')).toBe('Ana');
  });

  it('string com mais de 80 caracteres é truncada aos primeiros 80 após trim', () => {
    const long = `${'x'.repeat(DISPLAY_NAME_SNAPSHOT_MAX_LEN)}extra`;
    expect(long.trim().length).toBeGreaterThan(DISPLAY_NAME_SNAPSHOT_MAX_LEN);
    expect(normalizeDisplayNameForSnapshot(long)).toBe(
      'x'.repeat(DISPLAY_NAME_SNAPSHOT_MAX_LEN),
    );
  });
});

describe('isValidDisplayNameSnapshot', () => {
  it('null é válido', () => {
    expect(isValidDisplayNameSnapshot(null)).toBe(true);
  });

  it('string não vazia até 80 é válida', () => {
    expect(isValidDisplayNameSnapshot('João')).toBe(true);
    expect(isValidDisplayNameSnapshot('x'.repeat(DISPLAY_NAME_SNAPSHOT_MAX_LEN))).toBe(true);
  });

  it('string vazia ou só espaços é inválida', () => {
    expect(isValidDisplayNameSnapshot('')).toBe(false);
    expect(isValidDisplayNameSnapshot('   ')).toBe(false);
  });

  it('string longa é inválida (sem truncar na validação)', () => {
    expect(
      isValidDisplayNameSnapshot('y'.repeat(DISPLAY_NAME_SNAPSHOT_MAX_LEN + 1)),
    ).toBe(false);
  });

  it('tipos não string nem null são inválidos', () => {
    expect(isValidDisplayNameSnapshot(undefined)).toBe(false);
    expect(isValidDisplayNameSnapshot(1)).toBe(false);
  });
});

describe('resolveDisplayNameWithFallback', () => {
  it('usa snapshot quando existe', () => {
    expect(
      resolveDisplayNameWithFallback({
        snapshot: ' Snap ',
        profileDisplayName: 'Perfil',
        fallbackText: 'Genérico',
        uid: 'uid-1',
        includeUid: true,
      }),
    ).toBe('Snap');
  });

  it('usa profileDisplayName quando snapshot não existe', () => {
    expect(
      resolveDisplayNameWithFallback({
        snapshot: '',
        profileDisplayName: ' Maria ',
        fallbackText: 'Genérico',
      }),
    ).toBe('Maria');
  });

  it('usa fallback textual quando snapshot e perfil não existem', () => {
    expect(
      resolveDisplayNameWithFallback({
        snapshot: null,
        profileDisplayName: undefined,
        fallbackText: 'Conta local',
      }),
    ).toBe('Conta local');
  });

  it('UID só aparece com flag explícita, fallback vazio e uid válido', () => {
    expect(
      resolveDisplayNameWithFallback({
        snapshot: null,
        profileDisplayName: '',
        fallbackText: '',
        includeUid: false,
        uid: 'abc123',
      }),
    ).toBe('');
    expect(
      resolveDisplayNameWithFallback({
        snapshot: null,
        profileDisplayName: '',
        fallbackText: '',
        includeUid: true,
        uid: '  abc123  ',
      }),
    ).toBe('abc123');
  });

  it('com fallback não vazio, UID não substitui mesmo com flag', () => {
    expect(
      resolveDisplayNameWithFallback({
        snapshot: null,
        profileDisplayName: null,
        fallbackText: 'Cliente da plataforma',
        includeUid: true,
        uid: 'uid-z',
      }),
    ).toBe('Cliente da plataforma');
  });
});

describe('deriveLoanRequestClientFriendlyName / SupplierFriendlyName', () => {
  it('cliente usa fallback quando sem snapshot', () => {
    expect(deriveLoanRequestClientFriendlyName({})).toBe(
      NEW_LOCAL_CLIENT_NAME_FROM_PLATFORM_LOAN_REQUEST,
    );
    expect(deriveLoanRequestClientFriendlyName(null)).toBe(
      NEW_LOCAL_CLIENT_NAME_FROM_PLATFORM_LOAN_REQUEST,
    );
  });

  it('cliente usa snapshot quando existe', () => {
    expect(
      deriveLoanRequestClientFriendlyName({
        clientDisplayNameSnapshot: ' Carla ',
      }),
    ).toBe('Carla');
  });

  it('fornecedor usa fallback quando sem snapshot', () => {
    expect(deriveLoanRequestSupplierFriendlyName({})).toBe(
      PLATFORM_SUPPLIER_DISPLAY_FALLBACK,
    );
  });

  it('fornecedor usa snapshot quando existe', () => {
    expect(
      deriveLoanRequestSupplierFriendlyName({
        supplierDisplayNameSnapshot: ' Loja ',
      }),
    ).toBe('Loja');
  });
});

describe('pickSnapshotFields', () => {
  it('não muta o registo e só copia chaves presentes', () => {
    const doc = {
      clientDisplayNameSnapshot: 'c',
      foo: 1,
    };
    const copy = pickSnapshotFields(doc);
    expect(copy).toEqual({ clientDisplayNameSnapshot: 'c' });
    delete doc.clientDisplayNameSnapshot;
    expect(copy.clientDisplayNameSnapshot).toBe('c');
  });

  it('documento sem campos devolve objeto vazio', () => {
    expect(pickSnapshotFields({ a: 1 })).toEqual({});
  });
});

describe('normalizeSnapshotPatch / buildDisplayNameSnapshotsPartial', () => {
  it('normalizeSnapshotPatch só inclui chaves presentes no patch', () => {
    expect(normalizeSnapshotPatch({ clientDisplayNameSnapshot: ' X ' })).toEqual({
      clientDisplayNameSnapshot: 'X',
    });
    expect(normalizeSnapshotPatch({})).toEqual({});
  });

  it('normalizeSnapshotPatch converte bruto inválido em null quando chave existe', () => {
    expect(
      normalizeSnapshotPatch({ supplierDisplayNameSnapshot: '   ' }),
    ).toEqual({
      supplierDisplayNameSnapshot: null,
    });
  });

  it('buildDisplayNameSnapshotsPartial omite valores normalizados null mas preserva decisão por hasOwnProperty', () => {
    expect(
      buildDisplayNameSnapshotsPartial({
        clientDisplayNameSnapshot: '',
        supplierDisplayNameSnapshot: 'Ok',
      }),
    ).toEqual({ supplierDisplayNameSnapshot: 'Ok' });
  });

  it('buildDisplayNameSnapshotsPartial inclui ambos quando não nulos', () => {
    expect(
      buildDisplayNameSnapshotsPartial({
        clientDisplayNameSnapshot: 'A',
        supplierDisplayNameSnapshot: 'B',
      }),
    ).toEqual({
      clientDisplayNameSnapshot: 'A',
      supplierDisplayNameSnapshot: 'B',
    });
  });
});
