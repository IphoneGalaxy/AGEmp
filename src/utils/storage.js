/**
 * Módulo de persistência de dados.
 * Gerencia leitura/escrita no localStorage, migração de formatos antigos,
 * normalização de dados e operações de backup.
 */

import { SCOPE_ANONYMOUS, getScopedDataKey, getScopedConvertedLoanRequestsRegistryKey, getScopedClientDebtLedgerKey } from './storageScope';
import { normalizeLoanRequestConversionRegistry } from './loanRequestConversionRegistry';
import { emptyClientDebtLedger, normalizeClientDebtLedger } from './clientDebtLedger';

/**
 * Normaliza um empréstimo individual, garantindo que possua interestRate.
 * @param {Object} loan - Objeto do empréstimo.
 * @param {number} defaultRate - Taxa padrão de juros (%).
 * @returns {Object} Empréstimo normalizado.
 */
const normalizeLoan = (loan, defaultRate) => ({
  ...loan,
  interestRate: loan.interestRate != null ? loan.interestRate : defaultRate,
  payments: loan.payments || [],
});

/**
 * Normaliza um cliente, migrando formato antigo e garantindo interestRate nos empréstimos.
 *
 * Migrações:
 * - v1: client.transactions → client.loans (formato antigo com type 'loan'/'payment')
 * - v2: loan sem interestRate → adiciona interestRate com valor padrão
 * - linkContext: metadado opcional; preservado em todas as rotas de migração
 *
 * @param {Object} client - Objeto do cliente.
 * @param {number} defaultRate - Taxa de juros padrão.
 * @returns {Object} Cliente normalizado.
 */
const normalizeClient = (client, defaultRate) => {
  // Migração v1: formato antigo (transactions) → formato novo (loans)
  if (client.transactions && !client.loans) {
    const oldLoans = client.transactions
      .filter((t) => t.type === 'loan')
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const oldPayments = client.transactions
      .filter((t) => t.type === 'payment')
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const newLoans = oldLoans.map((l) => ({
      id: l.id,
      date: l.date,
      amount: l.amount,
      interestRate: defaultRate,
      payments: [],
    }));
    if (newLoans.length > 0 && oldPayments.length > 0) {
      newLoans[0].payments = oldPayments;
    }
    const migrated = { id: client.id, name: client.name, loans: newLoans };
    if (client.linkContext != null) {
      migrated.linkContext = client.linkContext;
    }
    if (client.archivedAt != null && typeof client.archivedAt === 'string' && client.archivedAt.trim()) {
      migrated.archivedAt = client.archivedAt.trim();
    }
    return migrated;
  }

  // Migração v2: adiciona interestRate a empréstimos que não possuem
  if (client.loans) {
    return {
      ...client,
      loans: client.loans.map((loan) => normalizeLoan(loan, defaultRate)),
    };
  }

  return { ...client, loans: [] };
};

/**
 * Normaliza uma lista de clientes, aplicando todas as migrações.
 * Usado ao carregar dados, importar backups e restaurar backups automáticos.
 *
 * @param {Array} clients - Lista de clientes (pode conter dados de qualquer versão).
 * @param {number} defaultRate - Taxa de juros padrão para contratos sem taxa definida.
 * @returns {Array} Lista de clientes normalizada.
 */
export const normalizeClients = (clients, defaultRate = 10) => {
  if (!Array.isArray(clients)) return [];
  return clients.map((c) => normalizeClient(c, defaultRate));
};

/**
 * Carrega os dados do localStorage com migração automática.
 * @param {number} defaultRate - Taxa padrão para empréstimos antigos.
 * @returns {{ fundsTransactions: Array, clients: Array } | null}
 */
/**
 * @param {number} [defaultRate]
 * @param {string} [scope] - padrão: escopo anônimo
 */
export const loadData = (defaultRate = 10, scope = SCOPE_ANONYMOUS) => {
  const key = getScopedDataKey(scope);
  const savedData = localStorage.getItem(key);
  if (!savedData) return null;

  const parsed = JSON.parse(savedData);
  const fundsTransactions = parsed.fundsTransactions || [];
  const clients = normalizeClients(parsed.clients, defaultRate);

  return { fundsTransactions, clients };
};

/**
 * Salva os dados no localStorage.
 * @param {Array} fundsTransactions - Transações do caixa pessoal.
 * @param {Array} clients - Lista de clientes.
 */
/**
 * @param {Array} fundsTransactions
 * @param {Array} clients
 * @param {string} [scope] - padrão: escopo anônimo
 */
export const saveData = (fundsTransactions, clients, scope = SCOPE_ANONYMOUS) => {
  const key = getScopedDataKey(scope);
  try {
    localStorage.setItem(key, JSON.stringify({ fundsTransactions, clients }));
  } catch (e) {
    console.warn('[storage] Falha ao salvar:', key, e);
  }
};

/**
 * Exporta os dados como arquivo .txt para download.
 * @param {Array} fundsTransactions - Transações do caixa.
 * @param {Array} clients - Lista de clientes.
 * @param {unknown} [clientDebtLedger] - Livro «Minhas dívidas» (normalizado na exportação).
 */
export const exportBackup = (fundsTransactions, clients, clientDebtLedger) => {
  const data = {
    fundsTransactions,
    clients,
    clientDebtLedger: normalizeClientDebtLedger(clientDebtLedger),
  };
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_financas_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Lê e valida um arquivo de backup importado.
 * @param {File} file - Arquivo selecionado pelo input.
 * @returns {Promise<{ fundsTransactions: Array, clients: Array, clientDebtLedger?: unknown }>}
 */
export const parseBackupFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed && Array.isArray(parsed.clients)) {
          resolve(parsed);
        } else {
          reject(new Error('INVALID_BACKUP'));
        }
      } catch (error) {
        reject(new Error('READ_ERROR'));
      }
    };
    reader.readAsText(file);
  });
};

/**
 * Registry escopado de conversões pré-financeiras já aplicadas neste aparelho.
 *
 * @param {string} [scope]
 * @returns {Record<string, unknown>[]}
 */
export function loadLoanRequestConversionRegistry(scope = SCOPE_ANONYMOUS) {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getScopedConvertedLoanRequestsRegistryKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeLoanRequestConversionRegistry(parsed);
  } catch {
    return [];
  }
}

/**
 * @param {unknown[]} registry
 * @param {string} [scope]
 */
export function saveLoanRequestConversionRegistry(registry, scope = SCOPE_ANONYMOUS) {
  if (typeof localStorage === 'undefined') return;
  const key = getScopedConvertedLoanRequestsRegistryKey(scope);
  try {
    const normalized = normalizeLoanRequestConversionRegistry(registry);
    localStorage.setItem(key, JSON.stringify(normalized));
  } catch (e) {
    console.warn('[storage] Falha ao salvar registry de conversões:', key, e);
  }
}

/**
 * Livro local «Minhas dívidas» (cliente) — separado de `loanManagerData` e do registry de conversão.
 *
 * @param {string} [scope]
 */
export function loadClientDebtLedger(scope = SCOPE_ANONYMOUS) {
  if (typeof localStorage === 'undefined') {
    return emptyClientDebtLedger();
  }
  try {
    const raw = localStorage.getItem(getScopedClientDebtLedgerKey(scope));
    if (!raw) {
      return emptyClientDebtLedger();
    }
    const parsed = JSON.parse(raw);
    return normalizeClientDebtLedger(parsed);
  } catch {
    return emptyClientDebtLedger();
  }
}

/**
 * @param {unknown} ledger
 * @param {string} [scope]
 */
export function saveClientDebtLedger(ledger, scope = SCOPE_ANONYMOUS) {
  if (typeof localStorage === 'undefined') return;
  const key = getScopedClientDebtLedgerKey(scope);
  try {
    const normalized = normalizeClientDebtLedger(ledger);
    localStorage.setItem(key, JSON.stringify(normalized));
  } catch (e) {
    console.warn('[storage] Falha ao salvar clientDebtLedger:', key, e);
  }
}
