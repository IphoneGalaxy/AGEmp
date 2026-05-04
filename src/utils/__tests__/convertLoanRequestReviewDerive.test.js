import { describe, it, expect } from 'vitest';
import {
  approvedAmountCentsToReaisOrNull,
  deriveLoanRequestClientDisplayLabel,
  deriveLoanRequestConversionReviewClientLabel,
  effectiveDefaultInterestRateFromSettings,
} from '../convertLoanRequestReviewDerive';

describe('convertLoanRequestReviewDerive', () => {
  describe('effectiveDefaultInterestRateFromSettings', () => {
    it('usa 10 quando vazio ou ausente', () => {
      expect(effectiveDefaultInterestRateFromSettings({ defaultInterestRate: '' })).toBe(10);
      expect(effectiveDefaultInterestRateFromSettings({})).toBe(10);
      expect(effectiveDefaultInterestRateFromSettings(undefined)).toBe(10);
    });
    it('preserva número válido', () => {
      expect(effectiveDefaultInterestRateFromSettings({ defaultInterestRate: 8 })).toBe(8);
      expect(effectiveDefaultInterestRateFromSettings({ defaultInterestRate: '12.5' })).toBe(12.5);
    });
    it('fallback 10 quando não finito', () => {
      expect(effectiveDefaultInterestRateFromSettings({ defaultInterestRate: NaN })).toBe(10);
    });
  });

  describe('deriveLoanRequestConversionReviewClientLabel', () => {
    it('usa snapshot quando existe', () => {
      expect(
        deriveLoanRequestConversionReviewClientLabel({ clientDisplayNameSnapshot: '  Ana  ' }),
      ).toBe('Ana');
    });
    it('fallback amigável sem snapshot', () => {
      expect(deriveLoanRequestConversionReviewClientLabel({})).toBe('Cliente da plataforma');
    });
  });

  describe('deriveLoanRequestClientDisplayLabel', () => {
    it('fallback sem UID', () => {
      expect(deriveLoanRequestClientDisplayLabel(null)).toBe('Cliente (UID indisponível)');
      expect(deriveLoanRequestClientDisplayLabel('')).toBe('Cliente (UID indisponível)');
    });
    it('prefixo quando UID longo', () => {
      expect(deriveLoanRequestClientDisplayLabel('abcdefghijklmnop')).toBe('Cliente abcdefgh…');
    });
    it('UID curto integral', () => {
      expect(deriveLoanRequestClientDisplayLabel('abc')).toBe('Cliente abc');
    });
  });

  describe('approvedAmountCentsToReaisOrNull', () => {
    it('converte centavos para reais', () => {
      expect(approvedAmountCentsToReaisOrNull(10000)).toBe(100);
    });
    it('null quando inválido', () => {
      expect(approvedAmountCentsToReaisOrNull('x')).toBeNull();
      expect(approvedAmountCentsToReaisOrNull(NaN)).toBeNull();
    });
  });
});
