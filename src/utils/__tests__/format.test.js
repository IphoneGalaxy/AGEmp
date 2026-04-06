/**
 * Testes unitários para funções de formatação (format.js).
 *
 * Cobertura:
 * - formatMoney: positivo, negativo, zero, decimal
 * - formatDate: válido, vazio, null
 * - capitalize: normal, vazia, já capitalizada
 * - formatRate: inteiro, decimal, zero
 * - formatDateTime: válido, vazio, null
 */

import { describe, it, expect } from 'vitest';
import { formatMoney, formatDate, capitalize, formatRate, formatDateTime } from '../format';

// ==================== formatMoney ====================

describe('formatMoney', () => {
  it('formata valor positivo como BRL', () => {
    const result = formatMoney(1234.56);
    // Verifica formato brasileiro: "R$ 1.234,56" (pode ter espaço não-quebrável)
    expect(result).toContain('R$');
    expect(result).toContain('1.234');
    expect(result).toContain('56');
  });

  it('formata zero', () => {
    const result = formatMoney(0);
    expect(result).toContain('R$');
    expect(result).toContain('0,00');
  });

  it('formata valor negativo', () => {
    const result = formatMoney(-500);
    expect(result).toContain('R$');
    expect(result).toContain('500');
  });

  it('formata centavos corretamente', () => {
    const result = formatMoney(0.01);
    expect(result).toContain('0,01');
  });

  it('formata valores grandes', () => {
    const result = formatMoney(1000000);
    expect(result).toContain('R$');
    expect(result).toContain('1.000.000');
  });
});

// ==================== formatDate ====================

describe('formatDate', () => {
  it('converte YYYY-MM-DD para DD/MM/YYYY', () => {
    expect(formatDate('2025-03-15')).toBe('15/03/2025');
  });

  it('retorna string vazia para input vazio', () => {
    expect(formatDate('')).toBe('');
  });

  it('retorna string vazia para null', () => {
    expect(formatDate(null)).toBe('');
  });

  it('retorna string vazia para undefined', () => {
    expect(formatDate(undefined)).toBe('');
  });

  it('formata corretamente primeiro dia do ano', () => {
    expect(formatDate('2025-01-01')).toBe('01/01/2025');
  });

  it('formata corretamente último dia do ano', () => {
    expect(formatDate('2025-12-31')).toBe('31/12/2025');
  });
});

// ==================== capitalize ====================

describe('capitalize', () => {
  it('capitaliza primeira letra de string lowercase', () => {
    expect(capitalize('teste')).toBe('Teste');
  });

  it('preserva string já capitalizada', () => {
    expect(capitalize('Teste')).toBe('Teste');
  });

  it('capitaliza string de uma letra', () => {
    expect(capitalize('a')).toBe('A');
  });

  it('preserva resto da string', () => {
    expect(capitalize('testCase')).toBe('TestCase');
  });
});

// ==================== formatRate ====================

describe('formatRate', () => {
  it('formata taxa inteira sem casas decimais', () => {
    expect(formatRate(10)).toBe('10%');
  });

  it('formata taxa com decimais', () => {
    const result = formatRate(8.5);
    // Pode ser "8,5%" em pt-BR
    expect(result).toContain('8');
    expect(result).toContain('5');
    expect(result).toContain('%');
  });

  it('formata taxa zero', () => {
    expect(formatRate(0)).toBe('0%');
  });

  it('formata taxa com duas casas decimais', () => {
    const result = formatRate(12.75);
    expect(result).toContain('12');
    expect(result).toContain('75');
    expect(result).toContain('%');
  });
});

// ==================== formatDateTime ====================

describe('formatDateTime', () => {
  it('formata timestamp ISO para formato pt-BR', () => {
    const result = formatDateTime('2025-04-05T14:30:00.000Z');
    // Deve conter data e hora formatadas
    expect(result).toContain('às');
  });

  it('retorna "—" para input vazio', () => {
    expect(formatDateTime('')).toBe('—');
  });

  it('retorna "—" para null', () => {
    expect(formatDateTime(null)).toBe('—');
  });

  it('retorna "—" para undefined', () => {
    expect(formatDateTime(undefined)).toBe('—');
  });
});
