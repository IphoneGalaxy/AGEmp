/**
 * Módulo de persistência de dados.
 * Gerencia leitura/escrita no localStorage, migração de formatos antigos,
 * normalização de dados e operações de backup.
 */

const STORAGE_KEY = 'loanManagerData';

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
    return { id: client.id, name: client.name, loans: newLoans };
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
export const loadData = (defaultRate = 10) => {
  const savedData = localStorage.getItem(STORAGE_KEY);
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
export const saveData = (fundsTransactions, clients) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ fundsTransactions, clients }));
};

/**
 * Exporta os dados como arquivo .txt para download.
 * @param {Array} fundsTransactions - Transações do caixa.
 * @param {Array} clients - Lista de clientes.
 */
export const exportBackup = (fundsTransactions, clients) => {
  const data = { fundsTransactions, clients };
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
 * @returns {Promise<{ fundsTransactions: Array, clients: Array }>}
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
