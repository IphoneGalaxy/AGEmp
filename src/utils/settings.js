/**
 * Módulo de gerenciamento de configurações.
 * Persiste preferências do usuário no localStorage.
 */

const SETTINGS_KEY = 'loanManagerSettings';

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
 * @returns {Object} Configurações completas.
 */
export const loadSettings = () => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(saved);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

/**
 * Salva configurações no localStorage.
 * @param {Object} settings - Objeto completo de configurações.
 */
export const saveSettings = (settings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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
