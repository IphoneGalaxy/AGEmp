/**
 * Módulo de backup automático.
 * Salva snapshots dos dados no localStorage em chave separada,
 * mantendo um histórico rotativo (FIFO) limitado.
 */

const AUTO_BACKUP_KEY = 'loanManagerAutoBackups';

/**
 * Retorna todos os backups automáticos armazenados.
 * @returns {Array<{ timestamp: string, data: Object }>} Lista de backups (mais recente primeiro).
 */
export const getAutoBackups = () => {
  try {
    const saved = localStorage.getItem(AUTO_BACKUP_KEY);
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
 * @param {number} maxBackups - Quantidade máxima de backups a manter.
 * @returns {Array} Lista atualizada de backups.
 */
export const createAutoBackup = (fundsTransactions, clients, maxBackups = 3) => {
  const backups = getAutoBackups();
  const newBackup = {
    timestamp: new Date().toISOString(),
    data: { fundsTransactions, clients },
  };
  const updated = [newBackup, ...backups].slice(0, maxBackups);
  try {
    localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(updated));
  } catch (e) {
    // Caso o localStorage esteja cheio, tenta com menos backups
    const minimal = [newBackup];
    localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(minimal));
  }
  return updated;
};

/**
 * Retorna o backup automático mais recente.
 * @returns {{ timestamp: string, data: Object } | null}
 */
export const getLastAutoBackup = () => {
  const backups = getAutoBackups();
  return backups.length > 0 ? backups[0] : null;
};

/**
 * Retorna os dados de um backup por índice.
 * @param {number} index - Índice do backup (0 = mais recente).
 * @returns {{ fundsTransactions: Array, clients: Array } | null}
 */
export const restoreAutoBackup = (index = 0) => {
  const backups = getAutoBackups();
  if (index >= backups.length) return null;
  return backups[index].data;
};

/**
 * Retorna a quantidade de backups automáticos armazenados.
 * @returns {number}
 */
export const getAutoBackupCount = () => {
  return getAutoBackups().length;
};
