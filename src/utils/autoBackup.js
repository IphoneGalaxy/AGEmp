/**
 * Módulo de backup automático.
 * Salva snapshots dos dados no localStorage em chave separada,
 * mantendo um histórico rotativo (FIFO) limitado.
 */

import { SCOPE_ANONYMOUS, getScopedAutoBackupsKey } from './storageScope';
import { normalizeClientDebtLedger } from './clientDebtLedger';

/**
 * Retorna todos os backups automáticos armazenados.
 * @param {string} [scope]
 * @returns {Array<{ timestamp: string, data: Object }>} Lista de backups (mais recente primeiro).
 */
export const getAutoBackups = (scope = SCOPE_ANONYMOUS) => {
  try {
    const key = getScopedAutoBackupsKey(scope);
    const saved = localStorage.getItem(key);
    if (!saved) return [];
    return JSON.parse(saved);
  } catch {
    return [];
  }
};

/**
 * Cria um novo backup automático e faz a rotação dos antigos.
 * @param {Array} fundsTransactions - Transações do caixa.
 * @param {Array} clients - Lista de clientes.
 * @param {unknown} [clientDebtLedger] - Livro «Minhas dívidas» (mesmo shape do backup manual).
 * @param {number} maxBackups - Quantidade máxima de backups a manter.
 * @param {string} [scope]
 * @returns {Array} Lista atualizada de backups.
 */
export const createAutoBackup = (
  fundsTransactions,
  clients,
  clientDebtLedger,
  maxBackups = 3,
  scope = SCOPE_ANONYMOUS,
) => {
  const backups = getAutoBackups(scope);
  const newBackup = {
    timestamp: new Date().toISOString(),
    data: {
      fundsTransactions,
      clients,
      clientDebtLedger: normalizeClientDebtLedger(clientDebtLedger),
    },
  };
  const updated = [newBackup, ...backups].slice(0, maxBackups);
  const key = getScopedAutoBackupsKey(scope);
  try {
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    // Caso o localStorage esteja cheio, tenta com menos backups
    const minimal = [newBackup];
    try {
      localStorage.setItem(key, JSON.stringify(minimal));
    } catch (e2) {
      console.warn('[autoBackup] Falha ao persistir backup:', e2);
    }
  }
  return updated;
};

/**
 * Retorna o backup automático mais recente.
 * @param {string} [scope]
 * @returns {{ timestamp: string, data: Object } | null}
 */
export const getLastAutoBackup = (scope = SCOPE_ANONYMOUS) => {
  const backups = getAutoBackups(scope);
  return backups.length > 0 ? backups[0] : null;
};

/**
 * Retorna os dados de um backup por índice.
 * @param {number} index - Índice do backup (0 = mais recente).
 * @param {string} [scope]
 * @returns {{ fundsTransactions: Array, clients: Array, clientDebtLedger?: unknown } | null}
 */
export const restoreAutoBackup = (index = 0, scope = SCOPE_ANONYMOUS) => {
  const backups = getAutoBackups(scope);
  if (index >= backups.length) return null;
  return backups[index].data;
};

/**
 * Retorna a quantidade de backups automáticos armazenados.
 * @param {string} [scope]
 * @returns {number}
 */
export const getAutoBackupCount = (scope = SCOPE_ANONYMOUS) => {
  return getAutoBackups(scope).length;
};
