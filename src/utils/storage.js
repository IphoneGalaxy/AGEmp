/**
 * Módulo de persistência de dados.
 * Gerencia leitura/escrita no localStorage, migração de formato antigo
 * e operações de backup (exportação e importação).
 */

const STORAGE_KEY = 'loanManagerData';

/**
 * Carrega os dados do localStorage e aplica migração de formato antigo se necessário.
 * O formato antigo usava `client.transactions` com tipo 'loan'/'payment'.
 * O formato atual usa `client.loans` com array de `payments` dentro de cada loan.
 *
 * @returns {{ fundsTransactions: Array, clients: Array } | null} Dados carregados ou null se vazio.
 */
export const loadData = () => {
  const savedData = localStorage.getItem(STORAGE_KEY);
  if (!savedData) return null;

  const parsed = JSON.parse(savedData);
  const fundsTransactions = parsed.fundsTransactions || [];
  let clients = [];

  if (parsed.clients) {
    clients = parsed.clients.map((client) => {
      // Migração: formato antigo (transactions) → formato novo (loans)
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
          payments: [],
        }));
        if (newLoans.length > 0 && oldPayments.length > 0) {
          newLoans[0].payments = oldPayments;
        }
        return { id: client.id, name: client.name, loans: newLoans };
      }
      return client;
    });
  }

  return { fundsTransactions, clients };
};

/**
 * Salva os dados no localStorage.
 * @param {Array} fundsTransactions - Transações do caixa pessoal.
 * @param {Array} clients - Lista de clientes com empréstimos e pagamentos.
 */
export const saveData = (fundsTransactions, clients) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ fundsTransactions, clients }));
};

/**
 * Exporta os dados como um arquivo .txt para download.
 * @param {Array} fundsTransactions - Transações do caixa pessoal.
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
 * Lê e valida um arquivo de backup importado pelo usuário.
 * @param {File} file - Arquivo selecionado pelo input file.
 * @returns {Promise<{ fundsTransactions: Array, clients: Array }>} Dados do backup.
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
