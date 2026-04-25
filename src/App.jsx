import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { calculateGlobalStats } from './utils/calculations';
import { loadData, saveData, exportBackup, parseBackupFile, normalizeClients } from './utils/storage';
import { loadSettings, saveSettings, getEffectiveTheme } from './utils/settings';
import { createAutoBackup, restoreAutoBackup } from './utils/autoBackup';
import { formatMoney } from './utils/format';
import {
  migrateLegacyKeysToAnonymousScope,
  getActiveStorageScope,
  shouldPromptLegacyOnLogin,
  associateAnonymousDataWithAccount,
  markKeepLegacySeparate,
} from './utils/storageScope';
import { useAuth } from './auth/AuthContext';
import Dashboard from './components/Dashboard';
import ClientsList from './components/ClientsList';
import ClientView from './components/ClientView';
import Settings from './components/Settings';
import Toast from './components/Toast';
import LegacyDataChoiceModal from './components/LegacyDataChoiceModal';
import { IconEye, IconEyeOff } from './components/Icons';
import './app.css';

/**
 * Componente raiz da aplicação.
 *
 * Responsabilidades:
 * - Gerenciar estado global (clientes, transações, configurações)
 * - Carregar/salvar dados no localStorage por escopo (anonymous / account:uid)
 * - Computar estatísticas globais via motor de cálculos
 * - Orquestrar navegação entre Dashboard, ClientsList, ClientView e Settings
 * - Gerenciar tema (claro/escuro/auto)
 * - Gerenciar backup manual e automático
 * - Controlar exibição/ocultação de valores monetários
 */
function App() {
  const { user, authReady } = useAuth();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [settings, setSettings] = useState(() => {
    if (typeof window !== 'undefined') {
      migrateLegacyKeysToAnonymousScope();
    }
    return loadSettings();
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [fundsTransactions, setFundsTransactions] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [legacyModalOpen, setLegacyModalOpen] = useState(false);

  const [valuesRevealed, setValuesRevealed] = useState(false);
  const shouldHideMoney = settings?.hideSensitiveValues && !valuesRevealed;

  const pendingAutoBackup = useRef(false);
  const lastScopeRef = useRef(null);
  const fundsRef = useRef([]);
  const clientsRef = useRef([]);
  const settingsRef = useRef(settings);
  useEffect(() => {
    fundsRef.current = fundsTransactions;
  }, [fundsTransactions]);
  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const displayMoney = useCallback(
    (value) => {
      if (shouldHideMoney) return 'R$ •••••';
      return formatMoney(value);
    },
    [shouldHideMoney]
  );

  const storageScope = getActiveStorageScope(user);
  const isAccountEmpty =
    bootstrapped &&
    user?.uid &&
    !legacyModalOpen &&
    clients.length === 0 &&
    fundsTransactions.length === 0;

  useEffect(() => {
    if (!settings) return;
    const applyTheme = () => {
      const effective = getEffectiveTheme(settings.theme);
      document.documentElement.setAttribute('data-theme', effective);
    };
    applyTheme();
    if (settings.theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', applyTheme);
      return () => mq.removeEventListener('change', applyTheme);
    }
  }, [settings?.theme, settings]);

  useEffect(() => {
    if (!settings) return;
    if (settings.reduceAnimations) {
      document.documentElement.classList.add('reduce-animations');
    } else {
      document.documentElement.classList.remove('reduce-animations');
    }
  }, [settings?.reduceAnimations, settings]);

  // Reidratação: migra legado, troca de conta, legado anônimo x conta
  useEffect(() => {
    if (!authReady) return;
    migrateLegacyKeysToAnonymousScope();
    const newScope = getActiveStorageScope(user);
    const oldScope = lastScopeRef.current;

    if (oldScope != null && oldScope !== newScope && settingsRef.current) {
      try {
        saveData(fundsRef.current, clientsRef.current, oldScope);
        saveSettings(settingsRef.current, oldScope);
      } catch (e) {
        console.warn('[App] Falha ao persistir escopo anterior:', e);
      }
    }

    const uid = user?.uid;
    const needLegacy = Boolean(uid && shouldPromptLegacyOnLogin(uid));

    if (needLegacy) {
      const s = loadSettings(newScope);
      setSettings(s);
      setActiveTab(s.defaultTab || 'dashboard');
      setFundsTransactions([]);
      setClients([]);
      setSelectedClient(null);
      setValuesRevealed(false);
      setLegacyModalOpen(true);
      lastScopeRef.current = newScope;
      setBootstrapped(true);
      return;
    }

    setLegacyModalOpen(false);
    const s = loadSettings(newScope);
    setSettings(s);
    setActiveTab(s.defaultTab || 'dashboard');
    const rate = s.defaultInterestRate || 10;
    const d = loadData(rate, newScope);
    if (d) {
      setFundsTransactions(d.fundsTransactions);
      setClients(d.clients);
    } else {
      setFundsTransactions([]);
      setClients([]);
    }
    setSelectedClient(null);
    setValuesRevealed(false);
    lastScopeRef.current = newScope;
    setBootstrapped(true);
  }, [authReady, user?.uid]);

  const handleUpdateSettings = (newSettings) => {
    setSettings(newSettings);
    if (!bootstrapped) return;
    const scope = getActiveStorageScope(user);
    saveSettings(newSettings, scope);
  };

  useEffect(() => {
    if (!bootstrapped || !settings) return;
    const scope = getActiveStorageScope(user);
    saveData(fundsTransactions, clients, scope);
    if (legacyModalOpen) {
      return;
    }
    if (pendingAutoBackup.current && settings.autoBackupEnabled) {
      createAutoBackup(fundsTransactions, clients, settings.maxAutoBackups, scope);
      pendingAutoBackup.current = false;
    }
  }, [fundsTransactions, clients, settings, user?.uid, bootstrapped, legacyModalOpen]);

  const triggerAutoBackup = () => {
    pendingAutoBackup.current = true;
  };

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
  const nextMonth = nextMonthDate.getMonth();
  const nextYear = nextMonthDate.getFullYear();

  const timeInfo = { currentMonth, currentYear, nextMonth, nextYear, today, nextMonthDate };

  const globalStats = useMemo(
    () => calculateGlobalStats(clients, fundsTransactions, timeInfo),
    [clients, fundsTransactions, currentMonth, currentYear, nextMonth, nextYear]
  );

  const handleExportBackup = () => {
    exportBackup(fundsTransactions, clients);
    showToast('✅ Backup salvo no celular!');
  };

  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!settings) {
      e.target.value = '';
      return;
    }

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
    if (!settings) return false;
    const scope = getActiveStorageScope(user);
    const backup = restoreAutoBackup(0, scope);
    if (!backup) {
      showToast('❌ Nenhum backup automático disponível.');
      return false;
    }
    const normalizedClients = normalizeClients(backup.clients, settings.defaultInterestRate || 10);
    setFundsTransactions(backup.fundsTransactions || []);
    setClients(normalizedClients);
    triggerAutoBackup();
    showToast('✅ Backup automático restaurado!');
    return true;
  };

  const handleLegacyAssociate = useCallback(() => {
    if (!user?.uid) return;
    try {
      associateAnonymousDataWithAccount(user.uid);
      setLegacyModalOpen(false);
      const sc = getActiveStorageScope(user);
      const s = loadSettings(sc);
      setSettings(s);
      const d = loadData(s.defaultInterestRate || 10, sc);
      if (d) {
        setFundsTransactions(d.fundsTransactions);
        setClients(d.clients);
      } else {
        setFundsTransactions([]);
        setClients([]);
      }
      showToast('✅ Dados associados a esta conta (neste aparelho).');
    } catch (e) {
      console.warn(e);
      showToast('❌ Não foi possível associar os dados agora. Tente de novo.');
    }
  }, [user]);

  const handleLegacyKeep = useCallback(() => {
    if (!user?.uid) return;
    markKeepLegacySeparate(user.uid);
    setLegacyModalOpen(false);
    const sc = getActiveStorageScope(user);
    const s = loadSettings(sc);
    setSettings(s);
    setFundsTransactions([]);
    setClients([]);
    showToast('Dados anteriores permanecem acessíveis após sair da conta.');
  }, [user]);

  const handleAddFundTransaction = (transaction) => {
    setFundsTransactions((prev) => [transaction, ...prev]);
    triggerAutoBackup();
  };

  const handleDeleteFundTransaction = (id) => {
    setFundsTransactions((prev) => prev.filter((f) => f.id !== id));
    triggerAutoBackup();
  };

  const handleAddClient = (client) => {
    setClients((prev) => [client, ...prev]);
    triggerAutoBackup();
  };

  const handleUpdateClients = (updater) => {
    setClients(updater);
    triggerAutoBackup();
  };

  if (!authReady || !bootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base text-content-muted p-4">
        <p className="text-sm">Carregando…</p>
      </div>
    );
  }

  const scopeLine =
    user?.uid == null
      ? 'Dados financeiros locais: modo sem conta neste aparelho.'
      : 'Dados financeiros locais: com conta neste aparelho.';

  return (
    <div className="max-w-xl mx-auto bg-base min-h-screen shadow-design-md relative overflow-hidden flex flex-col">
      {legacyModalOpen && user?.uid && user?.email && (
        <LegacyDataChoiceModal
          email={user.email}
          onAssociate={handleLegacyAssociate}
          onKeepOnDevice={handleLegacyKeep}
        />
      )}

      <div className="bg-surface pt-6 pb-3 px-4 sm:px-5 z-0 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-content tracking-tight">
          Finanças <span className="text-primary">Pro</span>
        </h1>

        {settings.hideSensitiveValues && !legacyModalOpen && (
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

      {isAccountEmpty && (
        <div
          className="border-b border-edge bg-surface-muted/80 px-4 py-2.5 sm:px-5"
          role="status"
        >
          <p className="text-center text-xs leading-relaxed text-content-muted">
            Esta conta ainda não tem dados financeiros locais neste aparelho. Empréstimos e caixa
            continuam salvos somente no dispositivo.
          </p>
        </div>
      )}

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
            localStorageScope={storageScope}
            localDataContextLine={scopeLine}
          />
        )}
      </div>

      {selectedClient && !legacyModalOpen && (
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

      <Toast message={toastMessage} />
    </div>
  );
}

export default App;
