import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { calculateGlobalStats } from './utils/calculations';
import {
  loadData,
  saveData,
  exportBackup,
  parseBackupFile,
  normalizeClients,
  loadLoanRequestConversionRegistry,
  saveLoanRequestConversionRegistry,
  loadClientDebtLedger,
  saveClientDebtLedger,
} from './utils/storage';
import { upsertLoanRequestConversionRegistryEntry } from './utils/loanRequestConversionRegistry';
import { isClientArchived } from './utils/clientArchive';
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
import { mapFirestoreError } from './firebase/firestoreErrors';
import { listUserLinks } from './firebase/links';
import { USER_ROLES, profileHasEffectiveAccountRole } from './firebase/roles';
import { ensureUserProfileExists, getUserProfile } from './firebase/users';
import { normalizeClientDebtLedger } from './utils/clientDebtLedger';
import Dashboard from './components/Dashboard';
import ClientsList from './components/ClientsList';
import ClientView from './components/ClientView';
import ClientSuppliersPanel from './components/ClientSuppliersPanel';
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
  const { user, authReady, authAvailable } = useAuth();
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
  const [loanRequestConversionRegistry, setLoanRequestConversionRegistry] = useState([]);
  const [clientDebtLedger, setClientDebtLedger] = useState(() => loadClientDebtLedger());
  const [selectedClient, setSelectedClient] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [legacyModalOpen, setLegacyModalOpen] = useState(false);

  const [remoteProfile, setRemoteProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileLoadToken, setProfileLoadToken] = useState(0);

  const [links, setLinks] = useState([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState('');
  const [linksReloadToken, setLinksReloadToken] = useState(0);

  const [accountScreenBootSubView, setAccountScreenBootSubView] = useState(null);

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
  const conversionRegistryRef = useRef([]);
  useEffect(() => {
    conversionRegistryRef.current = loanRequestConversionRegistry;
  }, [loanRequestConversionRegistry]);

  const clientDebtLedgerRef = useRef(clientDebtLedger);
  useEffect(() => {
    clientDebtLedgerRef.current = clientDebtLedger;
  }, [clientDebtLedger]);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const bumpLinksReload = useCallback(() => setLinksReloadToken((t) => t + 1), []);
  const reloadRemoteProfile = useCallback(() => setProfileLoadToken((t) => t + 1), []);

  const consumeAccountScreenBootSubView = useCallback(() => {
    setAccountScreenBootSubView(null);
  }, []);

  const handleOpenClientSolicitationsFromSuppliersTab = useCallback(() => {
    setAccountScreenBootSubView('loanRequests');
    setActiveTab('settings');
  }, []);

  const handleNavigateToSuppliersMainTab = useCallback(() => {
    setActiveTab('suppliers');
  }, []);

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
        saveLoanRequestConversionRegistry(conversionRegistryRef.current, oldScope);
        saveClientDebtLedger(normalizeClientDebtLedger(clientDebtLedgerRef.current), oldScope);
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
      setLoanRequestConversionRegistry([]);
      setClientDebtLedger(loadClientDebtLedger(newScope));
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
    setLoanRequestConversionRegistry(loadLoanRequestConversionRegistry(newScope));
    setClientDebtLedger(loadClientDebtLedger(newScope));
    setSelectedClient(null);
    setValuesRevealed(false);
    lastScopeRef.current = newScope;
    setBootstrapped(true);
  }, [authReady, user?.uid]);

  useEffect(() => {
    setAccountScreenBootSubView(null);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !authAvailable) {
      setRemoteProfile(null);
      setProfileError('');
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileError('');
      try {
        let data = await getUserProfile(user.uid);
        if (!cancelled && !data) {
          await ensureUserProfileExists(user);
          data = await getUserProfile(user.uid);
        }
        if (!cancelled) {
          setRemoteProfile(data);
        }
      } catch (e) {
        if (!cancelled) {
          setProfileError(mapFirestoreError(e));
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, authAvailable, profileLoadToken]);

  useEffect(() => {
    if (!user?.uid || !authAvailable) {
      setLinks([]);
      setLinksError('');
      return;
    }

    let cancelled = false;

    const loadLinks = async () => {
      setLinksLoading(true);
      setLinksError('');
      try {
        const list = await listUserLinks(user.uid);
        if (!cancelled) {
          setLinks(list);
        }
      } catch (e) {
        if (!cancelled) {
          setLinksError(mapFirestoreError(e));
        }
      } finally {
        if (!cancelled) {
          setLinksLoading(false);
        }
      }
    };

    void loadLinks();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, authAvailable, linksReloadToken]);

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
    saveLoanRequestConversionRegistry(loanRequestConversionRegistry, scope);
    if (legacyModalOpen) {
      return;
    }
    if (pendingAutoBackup.current && settings.autoBackupEnabled) {
      createAutoBackup(
        fundsTransactions,
        clients,
        clientDebtLedger,
        settings.maxAutoBackups,
        scope,
      );
      pendingAutoBackup.current = false;
    }
  }, [
    fundsTransactions,
    clients,
    clientDebtLedger,
    loanRequestConversionRegistry,
    settings,
    user?.uid,
    bootstrapped,
    legacyModalOpen,
  ]);

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
    exportBackup(fundsTransactions, clients, clientDebtLedger);
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
          const scope = getActiveStorageScope(user);
          const normalizedClients = normalizeClients(
            parsed.clients,
            settings.defaultInterestRate || 10,
          );
          const nextLedger = normalizeClientDebtLedger(parsed.clientDebtLedger ?? undefined);
          setFundsTransactions(parsed.fundsTransactions || []);
          setClients(normalizedClients);
          setClientDebtLedger(nextLedger);
          saveClientDebtLedger(nextLedger, scope);
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
    const nextLedger = normalizeClientDebtLedger(backup.clientDebtLedger ?? undefined);
    setFundsTransactions(backup.fundsTransactions || []);
    setClients(normalizedClients);
    setClientDebtLedger(nextLedger);
    saveClientDebtLedger(nextLedger, scope);
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
      setLoanRequestConversionRegistry(loadLoanRequestConversionRegistry(sc));
      setClientDebtLedger(loadClientDebtLedger(sc));
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
    setLoanRequestConversionRegistry(loadLoanRequestConversionRegistry(sc));
    setClientDebtLedger(loadClientDebtLedger(sc));
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

  const handleUpsertLoanRequestConversionRegistry = useCallback((entry) => {
    if (!entry || typeof entry !== 'object') return;
    setLoanRequestConversionRegistry((prev) =>
      upsertLoanRequestConversionRegistryEntry(prev, /** @type {any} */ (entry)),
    );
    triggerAutoBackup();
  }, []);

  const handleUpdateClientDebtLedger = useCallback(
    (updater) => {
      setClientDebtLedger((prev) => {
        const nextRaw = typeof updater === 'function' ? updater(prev) : updater;
        const next = normalizeClientDebtLedger(nextRaw);
        saveClientDebtLedger(next, getActiveStorageScope(user));
        return next;
      });
      triggerAutoBackup();
    },
    [user],
  );

  const activeClientsForList = useMemo(
    () => clients.filter((c) => !isClientArchived(c)),
    [clients],
  );

  const activeProcessedClients = useMemo(
    () => globalStats.processedClients.filter((c) => !isClientArchived(c)),
    [globalStats.processedClients],
  );

  const archivedProcessedClients = useMemo(
    () => globalStats.processedClients.filter((c) => isClientArchived(c)),
    [globalStats.processedClients],
  );

  const profileResolved = !profileLoading && !profileError;

  const showClientsTab =
    user?.uid == null ||
    !authAvailable ||
    !profileResolved ||
    profileHasEffectiveAccountRole(remoteProfile, USER_ROLES.SUPPLIER);

  const showSuppliersTab =
    Boolean(user?.uid && authAvailable && profileResolved) &&
    profileHasEffectiveAccountRole(remoteProfile, USER_ROLES.CLIENT);

  useEffect(() => {
    if (!bootstrapped) return;
    setActiveTab((prev) => sanitizeMainTab(prev, showClientsTab, showSuppliersTab));
  }, [bootstrapped, showClientsTab, showSuppliersTab]);

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
        {showClientsTab ? (
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
        ) : null}
        {showSuppliersTab ? (
          <button
            type="button"
            className={`inline-flex min-h-[44px] flex-1 items-center justify-center text-center text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring ${
              activeTab === 'suppliers'
                ? 'tab-active'
                : 'border-b-2 border-transparent text-content-muted'
            }`}
            onClick={() => setActiveTab('suppliers')}
          >
            Fornecedores
          </button>
        ) : null}
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
        {activeTab === 'clients' && showClientsTab && (
          <ClientsList
            clients={activeClientsForList}
            processedClients={activeProcessedClients}
            archivedProcessedClients={archivedProcessedClients}
            onAddClient={handleAddClient}
            onUpdateClients={handleUpdateClients}
            onSelectClient={setSelectedClient}
            showToast={showToast}
            displayMoney={displayMoney}
          />
        )}
        {activeTab === 'suppliers' && showSuppliersTab && (
          <div className="space-y-6 p-4 pb-20">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-content">Fornecedores</h2>
              <p className="mt-2 text-xs leading-relaxed text-content-muted">
                Relação pré-financeira na plataforma por fornecedor. Isso não substitui contratos
                locais nem sincroniza seu cadastro neste aparelho.
              </p>
            </div>
            <ClientSuppliersPanel
              user={user}
              showToast={showToast}
              links={links}
              linksLoading={linksLoading}
              onOpenSolicitations={handleOpenClientSolicitationsFromSuppliersTab}
              clientDebtLedger={clientDebtLedger}
              ledgerReferenceDate={timeInfo.today}
              displayMoney={displayMoney}
              onUpdateClientDebtLedger={handleUpdateClientDebtLedger}
            />
          </div>
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
            availableMoney={globalStats.availableMoney}
            clients={clients}
            loanRequestConversionRegistry={loanRequestConversionRegistry}
            onUpsertLoanRequestConversionRegistry={handleUpsertLoanRequestConversionRegistry}
            onUpdateClients={handleUpdateClients}
            remoteProfile={remoteProfile}
            setRemoteProfile={setRemoteProfile}
            profileLoading={profileLoading}
            profileError={profileError}
            reloadRemoteProfile={reloadRemoteProfile}
            links={links}
            linksLoading={linksLoading}
            linksError={linksError}
            bumpLinksReload={bumpLinksReload}
            accountScreenBootSubView={accountScreenBootSubView}
            onConsumedAccountScreenBootSubView={consumeAccountScreenBootSubView}
            onNavigateToSuppliersMainTab={handleNavigateToSuppliersMainTab}
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
          user={user}
        />
      )}

      <Toast message={toastMessage} />
    </div>
  );
}

function sanitizeMainTab(tab, showClientsTab, showSuppliersTab) {
  const raw = typeof tab === 'string' ? tab : 'dashboard';
  const t =
    raw === 'dashboard' || raw === 'clients' || raw === 'settings' || raw === 'suppliers'
      ? raw
      : 'dashboard';
  if (t === 'clients' && !showClientsTab) return 'dashboard';
  if (t === 'suppliers' && !showSuppliersTab) return 'dashboard';
  return t;
}

export default App;
