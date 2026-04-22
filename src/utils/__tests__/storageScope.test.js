import { describe, it, expect, beforeEach } from 'vitest';
import {
  SCOPE_ANONYMOUS,
  getScopedDataKey,
  getActiveStorageScope,
  migrateLegacyKeysToAnonymousScope,
  shouldPromptLegacyOnLogin,
  getLegacyDecisions,
  setLegacyDecision,
  scopeHasFinancialData,
  getScopedSettingsKey,
} from '../storageScope';

describe('storageScope', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('migra chaves antigas sem sufixo para o escopo anonymous', () => {
    localStorage.setItem('loanManagerData', JSON.stringify({ fundsTransactions: [], clients: [] }));
    localStorage.setItem('loanManagerSettings', JSON.stringify({ theme: 'dark' }));
    localStorage.setItem('loanManagerAutoBackups', JSON.stringify([]));

    migrateLegacyKeysToAnonymousScope();

    expect(localStorage.getItem('loanManagerData')).toBeNull();
    expect(localStorage.getItem('loanManagerSettings')).toBeNull();
    expect(localStorage.getItem('loanManagerAutoBackups')).toBeNull();
    expect(localStorage.getItem(getScopedDataKey(SCOPE_ANONYMOUS))).toBeTruthy();
    expect(localStorage.getItem(getScopedSettingsKey(SCOPE_ANONYMOUS))).toBeTruthy();
  });

  it('getActiveStorageScope: null user => anonymous', () => {
    expect(getActiveStorageScope(null)).toBe(SCOPE_ANONYMOUS);
  });

  it('getActiveStorageScope: user com uid => account:uid', () => {
    expect(getActiveStorageScope({ uid: 'abc' })).toBe('account:abc');
  });

  it('shouldPromptLegacyOnLogin: legado anônimo, conta vazia, sem decisão', () => {
    localStorage.setItem(
      getScopedDataKey(SCOPE_ANONYMOUS),
      JSON.stringify({
        fundsTransactions: [{ id: 'f1', amount: 1 }],
        clients: [],
      })
    );
    // conta sem chave
    expect(shouldPromptLegacyOnLogin('u1')).toBe(true);
  });

  it('shouldPromptLegacyOnLogin: falso após decisão', () => {
    setLegacyDecision('u1', 'separate');
    expect(shouldPromptLegacyOnLogin('u1')).toBe(false);
  });

  it('scopeHasFinancialData', () => {
    expect(scopeHasFinancialData(SCOPE_ANONYMOUS)).toBe(false);
    localStorage.setItem(
      getScopedDataKey(SCOPE_ANONYMOUS),
      JSON.stringify({ fundsTransactions: [], clients: [{ id: 'c1', name: 'A', loans: [] }] })
    );
    expect(scopeHasFinancialData(SCOPE_ANONYMOUS)).toBe(true);
  });

  it('getLegacyDecisions', () => {
    expect(getLegacyDecisions()).toEqual({});
    setLegacyDecision('x', 'associated');
    expect(getLegacyDecisions().x).toBe('associated');
  });
});
