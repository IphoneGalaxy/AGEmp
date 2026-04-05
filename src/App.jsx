import React, { useState, useEffect, useMemo } from 'react';
import { calculateGlobalStats } from './utils/calculations';
import { loadData, saveData, exportBackup, parseBackupFile } from './utils/storage';
import Dashboard from './components/Dashboard';
import ClientsList from './components/ClientsList';
import ClientView from './components/ClientView';
import Toast from './components/Toast';

/**
 * Componente raiz da aplicação.
 *
 * Responsabilidades:
 * - Gerenciar o estado global (clientes, transações, aba ativa, cliente selecionado)
 * - Carregar/salvar dados no localStorage
 * - Computar estatísticas globais via motor de cálculos
 * - Orquestrar navegação entre Dashboard, ClientsList e ClientView
 * - Gerenciar backup (exportar/importar)
 */
function App() {
  // ==================== ESTADO GLOBAL ====================
  const [activeTab, setActiveTab] = useState('dashboard');
  const [fundsTransactions, setFundsTransactions] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // ==================== TOAST ====================
  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // ==================== PERSISTÊNCIA ====================

  // Carregar dados iniciais (com migração automática de formato antigo)
  useEffect(() => {
    const data = loadData();
    if (data) {
      setFundsTransactions(data.fundsTransactions);
      setClients(data.clients);
    }
  }, []);

  // Salvar dados automaticamente a cada mudança
  useEffect(() => {
    saveData(fundsTransactions, clients);
  }, [fundsTransactions, clients]);

  // ==================== CONTROLE DE TEMPO ====================
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
  const nextMonth = nextMonthDate.getMonth();
  const nextYear = nextMonthDate.getFullYear();

  const timeInfo = { currentMonth, currentYear, nextMonth, nextYear, today, nextMonthDate };

  // ==================== MOTOR DE CÁLCULOS ====================
  const globalStats = useMemo(
    () => calculateGlobalStats(clients, fundsTransactions, timeInfo),
    [clients, fundsTransactions, currentMonth, currentYear, nextMonth, nextYear]
  );

  // ==================== HANDLERS DE BACKUP ====================

  const handleExportBackup = () => {
    exportBackup(fundsTransactions, clients);
    showToast('✅ Backup salvo no celular!');
  };

  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    parseBackupFile(file)
      .then((parsed) => {
        if (
          window.confirm(
            '⚠️ ATENÇÃO: Isso vai apagar os dados atuais e carregar o backup. Deseja continuar?'
          )
        ) {
          setFundsTransactions(parsed.fundsTransactions || []);
          setClients(parsed.clients);
          showToast('✅ Backup restaurado com sucesso!');
        }
      })
      .catch((error) => {
        if (error.message === 'INVALID_BACKUP') {
          showToast('❌ O arquivo selecionado não é um backup válido.');
        } else {
          showToast('❌ Erro ao ler o arquivo de backup.');
        }
      });
    e.target.value = ''; // Permite reimportar o mesmo arquivo
  };

  // ==================== HANDLERS DE CAIXA ====================

  const handleAddFundTransaction = (transaction) => {
    setFundsTransactions((prev) => [transaction, ...prev]);
  };

  const handleDeleteFundTransaction = (id) => {
    setFundsTransactions((prev) => prev.filter((f) => f.id !== id));
  };

  // ==================== HANDLERS DE CLIENTES ====================

  const handleAddClient = (client) => {
    setClients((prev) => [client, ...prev]);
  };

  /**
   * Recebe uma função updater que transforma o array de clientes.
   * Usado pelo ClientView para operações de CRUD em empréstimos e pagamentos.
   * @param {Function} updater - (clients) => newClients
   */
  const handleUpdateClients = (updater) => {
    setClients(updater);
  };

  // ==================== RENDERIZAÇÃO ====================

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen shadow-2xl relative overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white pt-10 pb-4 px-6 shadow-sm z-0">
        <h1 className="text-2xl font-black text-gray-800 tracking-tight">
          Finanças <span className="text-blue-600">Pro</span>
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex bg-white px-4 border-b border-gray-200">
        <button
          className={`flex-1 py-3 text-center text-sm transition-colors ${
            activeTab === 'dashboard' ? 'tab-active' : 'text-gray-500'
          }`}
          onClick={() => setActiveTab('dashboard')}
        >
          Painel
        </button>
        <button
          className={`flex-1 py-3 text-center text-sm transition-colors ${
            activeTab === 'clients' ? 'tab-active' : 'text-gray-500'
          }`}
          onClick={() => setActiveTab('clients')}
        >
          Clientes
        </button>
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 overflow-y-auto hide-scroll pb-10">
        {activeTab === 'dashboard' ? (
          <Dashboard
            globalStats={globalStats}
            fundsTransactions={fundsTransactions}
            onAddFundTransaction={handleAddFundTransaction}
            onDeleteFundTransaction={handleDeleteFundTransaction}
            onExport={handleExportBackup}
            onImport={handleImportBackup}
            showToast={showToast}
          />
        ) : (
          <ClientsList
            processedClients={globalStats.processedClients}
            clientsCount={clients.length}
            onAddClient={handleAddClient}
            onSelectClient={setSelectedClient}
            showToast={showToast}
          />
        )}
      </div>

      {/* Overlay: visão do cliente selecionado */}
      {selectedClient && (
        <ClientView
          clientData={globalStats.processedClients.find((c) => c.id === selectedClient.id)}
          availableMoney={globalStats.availableMoney}
          onUpdateClients={handleUpdateClients}
          onClose={() => setSelectedClient(null)}
          showToast={showToast}
        />
      )}

      {/* Toast de notificações */}
      <Toast message={toastMessage} />
    </div>
  );
}

export default App;
