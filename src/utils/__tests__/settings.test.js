/**
 * Testes unitários para o módulo de configurações (settings.js).
 *
 * Cobertura:
 * - loadSettings: localStorage vazio, com dados parciais, corrompido
 * - saveSettings: persistência no localStorage
 * - getEffectiveTheme: light, dark, auto (com mock de matchMedia)
 * - DEFAULT_SETTINGS: verificação de valores padrão
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadSettings, saveSettings, getEffectiveTheme, DEFAULT_SETTINGS } from '../settings';
import { SCOPE_ANONYMOUS, getScopedSettingsKey, migrateLegacyKeysToAnonymousScope } from '../storageScope';

const DEVICE_KEY = 'financasPro_deviceSettings';
const scopedKey = getScopedSettingsKey(SCOPE_ANONYMOUS);

describe('settings', () => {
  beforeEach(() => {
    localStorage.clear();
    migrateLegacyKeysToAnonymousScope();
  });

  // ==================== DEFAULT_SETTINGS ====================

  describe('DEFAULT_SETTINGS', () => {
    it('contém todas as chaves esperadas', () => {
      expect(DEFAULT_SETTINGS).toHaveProperty('theme', 'light');
      expect(DEFAULT_SETTINGS).toHaveProperty('reduceAnimations', false);
      expect(DEFAULT_SETTINGS).toHaveProperty('hideSensitiveValues', false);
      expect(DEFAULT_SETTINGS).toHaveProperty('autoBackupEnabled', true);
      expect(DEFAULT_SETTINGS).toHaveProperty('maxAutoBackups', 3);
      expect(DEFAULT_SETTINGS).toHaveProperty('defaultInterestRate', 10);
      expect(DEFAULT_SETTINGS).toHaveProperty('confirmDeleteClient', true);
      expect(DEFAULT_SETTINGS).toHaveProperty('confirmDeleteLoan', true);
      expect(DEFAULT_SETTINGS).toHaveProperty('confirmDeletePayment', true);
      expect(DEFAULT_SETTINGS).toHaveProperty('defaultTab', 'dashboard');
    });

    it('taxa padrão de juros é 10%', () => {
      expect(DEFAULT_SETTINGS.defaultInterestRate).toBe(10);
    });
  });

  // ==================== loadSettings ====================

  describe('loadSettings', () => {
    it('retorna defaults quando localStorage está vazio', () => {
      const result = loadSettings();
      expect(result).toEqual(DEFAULT_SETTINGS);
    });

    it('faz merge com dados parciais do localStorage', () => {
      localStorage.setItem(scopedKey, JSON.stringify({
        theme: 'dark',
        defaultInterestRate: 8,
      }));

      const result = loadSettings();

      expect(result.theme).toBe('dark');
      expect(result.defaultInterestRate).toBe(8);
      // Campos não salvos devem vir dos defaults
      expect(result.autoBackupEnabled).toBe(true);
      expect(result.maxAutoBackups).toBe(3);
      expect(result.reduceAnimations).toBe(false);
    });

    it('retorna defaults quando dados estão corrompidos', () => {
      localStorage.setItem(scopedKey, 'não é JSON!!!');

      const result = loadSettings();
      expect(result).toEqual(DEFAULT_SETTINGS);
    });

    it('novos campos adicionados aos defaults são incluídos no merge', () => {
      // Simula settings salvos antes de existir "defaultTab"
      localStorage.setItem(scopedKey, JSON.stringify({
        theme: 'dark',
      }));

      const result = loadSettings();
      expect(result.defaultTab).toBe('dashboard');
    });
  });

  // ==================== saveSettings ====================

  describe('saveSettings', () => {
    it('persiste configurações no localStorage', () => {
      const settings = { ...DEFAULT_SETTINGS, theme: 'dark', defaultInterestRate: 15 };
      saveSettings(settings, SCOPE_ANONYMOUS);

      const stored = JSON.parse(localStorage.getItem(scopedKey));
      expect(stored.defaultInterestRate).toBe(15);
      const device = JSON.parse(localStorage.getItem(DEVICE_KEY) || '{}');
      expect(device.theme).toBe('dark');
    });

    it('loadSettings recupera dados salvos por saveSettings', () => {
      const custom = { ...DEFAULT_SETTINGS, autoBackupEnabled: false, maxAutoBackups: 5 };
      saveSettings(custom);

      const loaded = loadSettings();
      expect(loaded.autoBackupEnabled).toBe(false);
      expect(loaded.maxAutoBackups).toBe(5);
    });
  });

  // ==================== getEffectiveTheme ====================

  describe('getEffectiveTheme', () => {
    it('retorna "light" quando tema é "light"', () => {
      expect(getEffectiveTheme('light')).toBe('light');
    });

    it('retorna "dark" quando tema é "dark"', () => {
      expect(getEffectiveTheme('dark')).toBe('dark');
    });

    it('retorna "dark" quando tema é "auto" e sistema prefere dark', () => {
      // Mock matchMedia para preferir dark
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockReturnValue({ matches: true });

      expect(getEffectiveTheme('auto')).toBe('dark');

      window.matchMedia = originalMatchMedia;
    });

    it('retorna "light" quando tema é "auto" e sistema prefere light', () => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      expect(getEffectiveTheme('auto')).toBe('light');

      window.matchMedia = originalMatchMedia;
    });
  });
});
