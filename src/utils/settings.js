/**
 * Módulo de gerenciamento de configurações.
 * Persiste preferências do usuário no localStorage.
 */

import {
  SCOPE_ANONYMOUS,
  getScopedSettingsKey,
  loadDeviceUiSettings,
  saveDeviceUiFromFullSettings,
} from './storageScope';

const DEVICE_UI_KEYS = ['theme', 'reduceAnimations', 'hideSensitiveValues'];

/** Configurações padrão da aplicação */
export const DEFAULT_SETTINGS = {
  theme: 'light',                // 'light' | 'dark' | 'auto'
  reduceAnimations: false,       // Desabilitar animações
  hideSensitiveValues: false,    // Ocultar valores monetários por padrão
  autoBackupEnabled: true,       // Backup automático ativo
  maxAutoBackups: 3,             // Máximo de backups automáticos (1, 3 ou 5)
  defaultInterestRate: 10,       // Taxa de juros padrão (%) para novos contratos
  confirmDeleteClient: true,     // Confirmar antes de excluir cliente
  confirmDeleteLoan: true,       // Confirmar antes de excluir contrato
  confirmDeletePayment: true,    // Confirmar antes de excluir pagamento
  defaultTab: 'dashboard',      // Aba inicial: 'dashboard' | 'clients' | 'settings'
};

/**
 * Carrega configurações do localStorage.
 * Faz merge com os defaults para garantir que campos novos existam.
 * @param {string} [scope] - padrão: anônimo; preferências de aparência vêm do dispositivo
 * @returns {Object} Configurações completas.
 */
export const loadSettings = (scope = SCOPE_ANONYMOUS) => {
  const device = loadDeviceUiSettings();
  let scoped = {};
  try {
    const saved = localStorage.getItem(getScopedSettingsKey(scope));
    if (saved) {
      scoped = JSON.parse(saved);
    }
  } catch {
    scoped = {};
  }
  const base = { ...DEFAULT_SETTINGS, ...scoped };
  for (const k of DEVICE_UI_KEYS) {
    if (k in device) {
      base[k] = device[k];
    }
  }
  return base;
};

/**
 * Salva configurações no localStorage.
 * @param {Object} settings - Objeto completo de configurações.
 * @param {string} [scope] - padrão: anônimo
 */
export const saveSettings = (settings, scope = SCOPE_ANONYMOUS) => {
  saveDeviceUiFromFullSettings(settings);
  const scoped = { ...settings };
  for (const k of DEVICE_UI_KEYS) {
    delete scoped[k];
  }
  try {
    localStorage.setItem(getScopedSettingsKey(scope), JSON.stringify(scoped));
  } catch (e) {
    console.warn('[settings] Falha ao salvar escopo:', scope, e);
  }
};

/**
 * Determina o tema efetivo com base na preferência do sistema.
 * @param {string} theme - 'light' | 'dark' | 'auto'
 * @returns {string} 'light' ou 'dark'
 */
export const getEffectiveTheme = (theme) => {
  if (theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
};
