import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { calculateGlobalStats } from './utils/calculations';
import { loadData, saveData, exportBackup, parseBackupFile, normalizeClients } from './utils/storage';
import { loadSettings, saveSettings, getEffectiveTheme } from './utils/settings';
import { createAutoBackup, restoreAutoBackup, getAutoBackupCount } from './utils/autoBackup';
import { formatMoney } from './utils/format';
import Dashboard from './components/Dashboard';
import ClientsList from './components/ClientsList';
import ClientView from './components/ClientView';
import Settings from './components/Settings';
import Toast from './components/Toast';
import { IconEye, IconEyeOff } from './components/Icons';
import './app.css';

/**
 * Componente raiz da aplicação.
 *
 * Responsabilidades:
 * - Gerenciar estado global (clientes, transações, configurações)
 * - Carregar/salvar dados no localStorage
 * - Computar estatísticas globais via motor de cálculos
 * - Orquestrar navegação entre Dashboard, ClientsList, ClientView e Settings
 * - Gerenciar tema (claro/escuro/auto)
 * - Gerenciar backup manual e automático
 * - Controlar exibição/ocultação de valores monetários
 */
function App() {
  // ==================== CONFIGURAÇÕES ====================
  const [settings, setSettings] = useState(() => loadSettings());

  // ==================== ESTADO GLOBAL ====================
  const [activeTab, setActiveTab] = useState(settings.defaultTab || 'dashboard');
  const [fundsTransactions, setFundsTransactions] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // Controle de visibilidade de valores monetários
  const [valuesRevealed, setValuesRevealed] = useState(false);
  const shouldHideMoney = settings.hideSensitiveValues && !valuesRevealed;

  // Ref para controle de auto-backup (evita backup no carregamento inicial)
  const pendingAutoBackup = useRef(false);

  // ==================== TOAST ====================
  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // ==================== DISPLAY MONEY ====================
  /**
   * Formata valores monetários ou os oculta se a configuração estiver ativa.
   * Componentes usam esta função em vez de formatMoney diretamente para display.
   */
  const displayMoney = useCallback(
    (value) => {
      if (shouldHideMoney) return 'R$ •••••';
      return formatMoney(value);
    },
    [shouldHideMoney]
  );

  // ==================== TEMA ====================
  useEffect(() => {
    const applyTheme = () => {
      const effective = getEffectiveTheme(settings.theme);
      document.documentElement.setAttribute('data-theme', effective);
    };

    applyTheme();

    // Listener para mudança de preferência do sistema (modo auto)
    if (settings.theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', applyTheme);
      return () => mq.removeEventListener('change', applyTheme);
    }
  }, [settings.theme]);

  // ==================== REDUZIR ANIMAÇÕES ====================
  useEffect(() => {
    if (settings.reduceAnimations) {
      document.documentElement.classList.add('reduce-animations');
    } else {
      document.documentElement.classList.remove('reduce-animations');
    }
  }, [settings.reduceAnimations]);

  // ==================== PERSISTÊNCIA DE SETTINGS ====================
  const handleUpdateSettings = (newSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // ==================== PERSISTÊNCIA DE DADOS ====================

  // Carregar dados iniciais (com migração automática)
  useEffect(() => {
    const data = loadData(settings.defaultInterestRate || 10);
    if (data) {
      setFundsTransactions(data.fundsTransactions);
      setClients(data.clients);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salvar dados + auto-backup a cada mudança de estado
  useEffect(() => {
    saveData(fundsTransactions, clients);

    if (pendingAutoBackup.current && settings.autoBackupEnabled) {
      createAutoBackup(fundsTransactions, clients, settings.maxAutoBackups);
      pendingAutoBackup.current = false;
    }
  }, [fundsTransactions, clients, settings.autoBackupEnabled, settings.maxAutoBackups]);

  /**
   * Marca que o próximo save deve criar um auto-backup.
   * Chamado por todos os handlers de ações "importantes".
   */
  const triggerAutoBackup = () => {
    pendingAutoBackup.current = true;
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          const normalizedClients = normalizeClients(
            parsed.clients,
            settings.defaultInterestRate || 10
          );
          setFundsTransactions(parsed.fundsTransactions || []);
          setClients(normalizedClients);
          triggerAutoBackup();
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
    e.target.value = '';
  };

  const handleRestoreAutoBackup = () => {
    const backup = restoreAutoBackup(0);
    if (!backup) {
      showToast('❌ Nenhum backup automático disponível.');
      return false;
    }
    const normalizedClients = normalizeClients(
      backup.clients,
      settings.defaultInterestRate || 10
    );
    setFundsTransactions(backup.fundsTransactions || []);
    setClients(normalizedClients);
    triggerAutoBackup();
    showToast('✅ Backup automático restaurado!');
    return true;
  };

  // ==================== HANDLERS DE CAIXA ====================

  const handleAddFundTransaction = (transaction) => {
    setFundsTransactions((prev) => [transaction, ...prev]);
    triggerAutoBackup();
  };

  const handleDeleteFundTransaction = (id) => {
    setFundsTransactions((prev) => prev.filter((f) => f.id !== id));
    triggerAutoBackup();
  };

  // ==================== HANDLERS DE CLIENTES ====================

  const handleAddClient = (client) => {
    setClients((prev) => [client, ...prev]);
    triggerAutoBackup();
  };

  /**
   * Recebe uma função updater que transforma o array de clientes.
   * Usado pelo ClientView para operações de CRUD em empréstimos e pagamentos.
   */
  const handleUpdateClients = (updater) => {
    setClients(updater);
    triggerAutoBackup();
  };

  // ==================== RENDERIZAÇÃO ====================

  return (
    <div className="max-w-xl mx-auto bg-base min-h-screen shadow-design-md relative overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-surface pt-6 pb-3 px-4 sm:px-5 z-0 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-content tracking-tight">
          Finanças <span className="text-primary">Pro</span>
        </h1>

        {/* Botão olho: só aparece se ocultar valores estiver ativo */}
        {settings.hideSensitiveValues && (
          <button
            type="button"
            onClick={() => setValuesRevealed((v) => !v)}
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-content-muted transition-colors hover:bg-surface-muted active:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
            title={valuesRevealed ? 'Ocultar valores' : 'Revelar valores'}
            aria-label={valuesRevealed ? 'Ocultar valores monetários' : 'Revelar valores monetários'}
          >
            {valuesRevealed ? <IconEye /> : <IconEyeOff />}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-surface px-3 sm:px-4 border-b border-edge">
        <button
          type="button"
          className={`inline-flex min-h-[44px] flex-1 items-center justify-center text-center text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring ${
            activeTab === 'dashboard'
              ? 'tab-active'
              : 'border-b-2 border-transparent text-content-muted'
          }`}
          onClick={() => setActiveTab('dashboard')}
        >
          Painel
        </button>
        <button
          type="button"
          className={`inline-flex min-h-[44px] flex-1 items-center justify-center text-center text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring ${
            activeTab === 'clients'
              ? 'tab-active'
              : 'border-b-2 border-transparent text-content-muted'
          }`}
          onClick={() => setActiveTab('clients')}
        >
          Clientes
        </button>
        <button
          type="button"
          className={`inline-flex min-h-[44px] flex-1 items-center justify-center text-center text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring ${
            activeTab === 'settings'
              ? 'tab-active'
              : 'border-b-2 border-transparent text-content-muted'
          }`}
          onClick={() => setActiveTab('settings')}
        >
          Config.
        </button>
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 overflow-y-auto hide-scroll pb-10 bg-base">
        {activeTab === 'dashboard' && (
          <Dashboard
            globalStats={globalStats}
            fundsTransactions={fundsTransactions}
            onAddFundTransaction={handleAddFundTransaction}
            onDeleteFundTransaction={handleDeleteFundTransaction}
            showToast={showToast}
            displayMoney={displayMoney}
          />
        )}
        {activeTab === 'clients' && (
          <ClientsList
            processedClients={globalStats.processedClients}
            clientsCount={clients.length}
            onAddClient={handleAddClient}
            onSelectClient={setSelectedClient}
            showToast={showToast}
            displayMoney={displayMoney}
          />
        )}
        {activeTab === 'settings' && (
          <Settings
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onExport={handleExportBackup}
            onImport={handleImportBackup}
            onRestoreAutoBackup={handleRestoreAutoBackup}
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
          displayMoney={displayMoney}
          settings={settings}
        />
      )}

      {/* Toast de notificações */}
      <Toast message={toastMessage} />
    </div>
  );
}

export default App;
