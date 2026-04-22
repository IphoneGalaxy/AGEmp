import { describe, expect, it } from 'vitest';

import {
  describeInvalidSupplierUidForLink,
  looksLikeFirebaseUid,
  mapFirestoreError,
  mapLinkFirestoreError,
  normalizeFirestoreErrorCode,
} from '../firestoreErrors';

describe('firebase/firestoreErrors', () => {
  describe('normalizeFirestoreErrorCode', () => {
    it('normaliza códigos com prefixo firestore/', () => {
      expect(normalizeFirestoreErrorCode({ code: 'firestore/permission-denied' })).toBe(
        'permission-denied'
      );
      expect(normalizeFirestoreErrorCode({ code: 'permission-denied' })).toBe('permission-denied');
    });

    it('retorna null para erro sem code', () => {
      expect(normalizeFirestoreErrorCode(null)).toBeNull();
      expect(normalizeFirestoreErrorCode({})).toBeNull();
    });
  });

  describe('mapLinkFirestoreError', () => {
    it('expande permission-denied com texto de fallback para vínculos', () => {
      const msg = mapLinkFirestoreError({ code: 'permission-denied' });
      expect(msg).toContain('servidor negou');
      expect(msg).toContain('Firebase');
    });

    it('usa mensagem específica para not-found', () => {
      const msg = mapLinkFirestoreError({ code: 'not-found' });
      expect(msg).toContain('Registro não encontrado');
    });

    it('recai em mapFirestoreError para código desconhecido', () => {
      expect(mapLinkFirestoreError({ code: 'desconhecido-xyz' })).toBe(
        'Não foi possível salvar. Tente novamente.'
      );
    });
  });

  describe('mapFirestoreError', () => {
    it('reconhece permission-denied com prefixo', () => {
      expect(mapFirestoreError({ code: 'firestore/permission-denied' })).toBe(
        'Sem permissão para salvar. Verifique se você está conectado.'
      );
    });
  });

  describe('looksLikeFirebaseUid', () => {
    it('aceita UIDs alfanuméricos típicos', () => {
      expect(looksLikeFirebaseUid('a'.repeat(28))).toBe(true);
    });

    it('rejeita e-mail e espaços', () => {
      expect(looksLikeFirebaseUid('a@b.com')).toBe(false);
      expect(looksLikeFirebaseUid('abc def')).toBe(false);
    });

    it('rejeita string curta demais', () => {
      expect(looksLikeFirebaseUid('shortuid12')).toBe(false);
    });
  });

  describe('describeInvalidSupplierUidForLink', () => {
    it('retorna null para UID plausível', () => {
      expect(
        describeInvalidSupplierUidForLink('a'.repeat(28), 'b'.repeat(28))
      ).toBeNull();
    });

    it('detecta e-mail', () => {
      expect(describeInvalidSupplierUidForLink('x@y.com', 'client')).toMatch(/e-mail/i);
    });
  });
});
