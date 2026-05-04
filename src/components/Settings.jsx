import React, { useState, useRef, useEffect } from 'react';
import { formatDateTime } from '../utils/format';
import { getAutoBackupCount, getLastAutoBackup } from '../utils/autoBackup';
import AccountScreen from './AccountScreen';
import { effectiveDefaultInterestRateFromSettings } from '../utils/convertLoanRequestReviewDerive';

/**
 * Toggle switch reutilizável.
 */
const Toggle = ({ enabled, onToggle, label, description }) => (
  <div className="flex items-center justify-between gap-4 border-b border-edge/60 py-3 last:border-b-0">
    <div className="min-w-0 flex-1">
      <span className="text-sm font-medium text-content">{label}</span>
      {description && (
        <p className="mt-1 text-xs leading-relaxed text-content-muted">{description}</p>
      )}
    </div>
    <button
      type="button"
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring ${
        enabled ? 'bg-primary' : 'bg-surface-muted ring-1 ring-inset ring-edge'
      }`}
      aria-pressed={enabled}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow-design-sm transition-transform ${
          enabled ? 'translate-x-5' : ''
        }`}
      />
    </button>
  </div>
);

/**
 * Grupo de opções (botões segmentados).
 */
const OptionGroup = ({ options, value, onChange }) => (
  <div
    className="flex gap-0.5 rounded-design-md bg-surface-muted p-1 ring-1 ring-inset ring-edge/50"
    role="group"
  >
    {options.map((opt) => (
      <button
        key={String(opt.value)}
        type="button"
        onClick={() => onChange(opt.value)}
        className={`flex min-h-10 flex-1 items-center justify-center rounded-design-sm px-2 text-xs font-semibold transition-colors ${
          value === opt.value
            ? 'bg-surface text-primary shadow-design-sm ring-1 ring-edge/40'
            : 'text-content-muted hover:text-content-soft'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

/**
 * Componente Tela de Configurações.
 *
 * Organizada em seções/cartões:
 * - Aparência (tema, animações, ocultar valores)
 * - Backup e Segurança (auto-backup, exportar, importar, restaurar)
 * - Operação (confirmações, aba inicial)
 * - Financeiro (taxa de juros padrão)
 * - Sobre
 *
 * @param {Object} props
 * @param {Object}   props.settings - Estado atual das configurações.
 * @param {Function} props.onUpdateSettings - Callback para atualizar configurações.
 * @param {Function} props.onExport - Callback para exportar backup manual.
 * @param {Function} props.onImport - Callback para importar backup manual (recebe event).
 * @param {Function} props.onRestoreAutoBackup - Callback para restaurar backup automático.
 * @param {Function} props.showToast - Callback para exibir toast.
 * @param {string} [props.localStorageScope] - Escopo ativo (anonymous / account:uid) para backups.
 * @param {string} [props.localDataContextLine] - Linha discreta de contexto local.
 * @param {number} [props.availableMoney] - Total disponível local (reais), de calculateGlobalStats — painel fornecedor LoanRequest (B2).
 */
const Settings = ({
  settings,
  onUpdateSettings,
  onExport,
  onImport,
  onRestoreAutoBackup,
  showToast,
  localStorageScope = 'anonymous',
  localDataContextLine,
  availableMoney,
}) => {
  const fileInputRef = useRef(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  /** 'main' | 'account' — sub-tela isolada; não cria aba principal. */
  const [settingsView, setSettingsView] = useState('main');

  // Info de backups automáticos (lida direto do localStorage)
  const [backupInfo, setBackupInfo] = useState(() => ({
    count: getAutoBackupCount(localStorageScope),
    last: getLastAutoBackup(localStorageScope),
  }));

  useEffect(() => {
    setBackupInfo({
      count: getAutoBackupCount(localStorageScope),
      last: getLastAutoBackup(localStorageScope),
    });
  }, [localStorageScope]);

  const refreshBackupInfo = () => {
    setBackupInfo({
      count: getAutoBackupCount(localStorageScope),
      last: getLastAutoBackup(localStorageScope),
    });
  };

  const updateSetting = (key, value) => {
    onUpdateSettings({ ...settings, [key]: value });
  };

  const handleRestore = () => {
    const success = onRestoreAutoBackup();
    if (success) {
      setConfirmRestore(false);
      refreshBackupInfo();
    }
  };

  const sectionCardClass =
    'rounded-design-lg border border-edge bg-surface p-5 shadow-design-sm sm:p-6';

  if (settingsView === 'account') {
    return (
      <AccountScreen
        onBack={() => setSettingsView('main')}
        showToast={showToast}
        availableMoney={availableMoney}
        defaultInterestRate={effectiveDefaultInterestRateFromSettings(settings)}
      />
    );
  }

  return (
    <div className="space-y-6 p-4 pb-20">
      {/* ===== APARÊNCIA ===== */}
      <div className={sectionCardClass}>
        <h3 className="mb-4 text-lg font-semibold tracking-tight text-content">🎨 Aparência</h3>

        <div className="mb-5">
          <label className="mb-2 block text-sm font-medium text-content-soft">Tema</label>
          <OptionGroup
            options={[
              { value: 'light', label: '☀️ Claro' },
              { value: 'dark', label: '🌙 Escuro' },
              { value: 'auto', label: '⚙️ Auto' },
            ]}
            value={settings.theme}
            onChange={(v) => updateSetting('theme', v)}
          />
        </div>

        <div className="-mx-1">
          <Toggle
            label="Reduzir animações"
            description="Desativa transições e efeitos visuais"
            enabled={settings.reduceAnimations}
            onToggle={() => updateSetting('reduceAnimations', !settings.reduceAnimations)}
          />

          <Toggle
            label="Ocultar valores monetários"
            description="Esconde valores sensíveis por padrão (use o ícone 👁 no topo para revelar)"
            enabled={settings.hideSensitiveValues}
            onToggle={() => updateSetting('hideSensitiveValues', !settings.hideSensitiveValues)}
          />
        </div>
      </div>

      {/* ===== CONTA (opcional, Firebase Auth) ===== */}
      <div className={sectionCardClass}>
        <h3 className="mb-1 text-lg font-semibold tracking-tight text-content">Conta</h3>
        {localDataContextLine && (
          <p className="mb-3 rounded-design-md border border-edge/60 bg-surface-muted px-3 py-2 text-xs leading-relaxed text-content-muted">
            {localDataContextLine}
          </p>
        )}
        <p className="mb-5 text-xs leading-relaxed text-content-muted">
          Entre com e-mail para usar identidade e vínculos entre contas. Seus empréstimos e caixa
          continuam locais neste aparelho.
        </p>
        <button
          type="button"
          onClick={() => setSettingsView('account')}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-primary-soft text-sm font-semibold text-primary transition-colors active:bg-primary-soft/80"
        >
          Gerenciar conta
        </button>
      </div>

      {/* ===== BACKUP E SEGURANÇA ===== */}
      <div className={sectionCardClass}>
        <h3 className="mb-1 text-lg font-semibold tracking-tight text-content">
          🔒 Backup e Segurança
        </h3>
        <p className="mb-5 text-xs leading-relaxed text-content-muted">
          O backup automático salva cópias locais dos dados financeiros deste escopo a cada
          alteração importante.
        </p>

        <div className="-mx-1">
          <Toggle
            label="Backup automático"
            description="Cria cópia interna a cada alteração importante"
            enabled={settings.autoBackupEnabled}
            onToggle={() => updateSetting('autoBackupEnabled', !settings.autoBackupEnabled)}
          />
        </div>

        {settings.autoBackupEnabled && (
          <div className="mb-1 mt-4">
            <label className="mb-2 block text-sm font-medium text-content-soft">
              Máximo de backups automáticos
            </label>
            <OptionGroup
              options={[
                { value: 1, label: '1' },
                { value: 3, label: '3' },
                { value: 5, label: '5' },
              ]}
              value={settings.maxAutoBackups}
              onChange={(v) => updateSetting('maxAutoBackups', v)}
            />
          </div>
        )}

        {/* Info de backups */}
        <div className="mt-4 space-y-2 rounded-design-lg border border-edge bg-surface-muted p-4">
          <div className="flex items-start justify-between gap-3 text-xs">
            <span className="text-content-muted">Backups armazenados:</span>
            <span className="shrink-0 font-semibold tabular-nums text-content">{backupInfo.count}</span>
          </div>
          <div className="flex items-start justify-between gap-3 text-xs">
            <span className="text-content-muted">Último backup automático:</span>
            <span className="max-w-[55%] shrink-0 text-right font-semibold text-content">
              {backupInfo.last ? formatDateTime(backupInfo.last.timestamp) : 'Nenhum'}
            </span>
          </div>
        </div>

        {/* Restaurar backup automático */}
        {!confirmRestore ? (
          <button
            onClick={() => {
              if (backupInfo.count === 0) {
                showToast('❌ Nenhum backup automático disponível.');
                return;
              }
              setConfirmRestore(true);
            }}
            className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-warning-soft text-sm font-semibold text-content-soft transition-colors active:bg-warning-soft/80"
          >
            🔄 Restaurar último backup automático
          </button>
        ) : (
          <div
            className="mt-4 rounded-design-lg border border-edge bg-warning-soft p-4 text-center animate-fade-in"
            role="alert"
          >
            <p className="mb-4 text-sm font-semibold leading-snug text-content">
              ⚠️ Isso vai substituir todos os dados atuais pelo último backup automático. Continuar?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmRestore(false)}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-design-md border border-edge bg-surface text-sm font-semibold text-content-soft transition-colors active:bg-surface-muted"
              >
                Cancelar
              </button>
              <button
                onClick={handleRestore}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-design-md bg-warning text-sm font-semibold text-content-inverse shadow-design-sm transition-colors active:opacity-90"
              >
                Sim, Restaurar
              </button>
            </div>
          </div>
        )}

        {/* Backup manual */}
        <div className="mt-6 border-t border-edge pt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-content-muted">
            Backup Manual (Arquivo)
          </p>
          <div className="flex gap-2">
            <button
              onClick={onExport}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-design-md border border-edge bg-primary-soft text-sm font-semibold text-primary transition-colors active:bg-primary-soft/80"
            >
              📥 Salvar Backup
            </button>
            <button
              onClick={() => fileInputRef.current.click()}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-design-md border border-edge bg-surface-muted text-sm font-semibold text-content-soft transition-colors active:bg-surface-muted/80"
            >
              📤 Importar
            </button>
            <input
              type="file"
              accept=".txt,.json"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={(e) => {
                onImport(e);
                // Atualiza info de backup após importação
                setTimeout(refreshBackupInfo, 500);
              }}
            />
          </div>
        </div>
      </div>

      {/* ===== OPERAÇÃO ===== */}
      <div className={sectionCardClass}>
        <h3 className="mb-4 text-lg font-semibold tracking-tight text-content">⚙️ Operação</h3>

        <div className="-mx-1">
          <Toggle
            label="Confirmar exclusão de cliente"
            enabled={settings.confirmDeleteClient}
            onToggle={() => updateSetting('confirmDeleteClient', !settings.confirmDeleteClient)}
          />
          <Toggle
            label="Confirmar exclusão de contrato"
            enabled={settings.confirmDeleteLoan}
            onToggle={() => updateSetting('confirmDeleteLoan', !settings.confirmDeleteLoan)}
          />
          <Toggle
            label="Confirmar exclusão de pagamento"
            enabled={settings.confirmDeletePayment}
            onToggle={() => updateSetting('confirmDeletePayment', !settings.confirmDeletePayment)}
          />
        </div>

        <div className="mt-5 border-t border-edge pt-5">
          <label className="mb-2 block text-sm font-medium text-content-soft">Aba inicial padrão</label>
          <OptionGroup
            options={[
              { value: 'dashboard', label: 'Painel' },
              { value: 'clients', label: 'Clientes' },
              { value: 'settings', label: 'Config.' },
            ]}
            value={settings.defaultTab}
            onChange={(v) => updateSetting('defaultTab', v)}
          />
        </div>
      </div>

      {/* ===== FINANCEIRO ===== */}
      <div className={sectionCardClass}>
        <h3 className="mb-1 text-lg font-semibold tracking-tight text-content">💰 Financeiro</h3>
        <p className="mb-5 text-xs leading-relaxed text-content-muted">
          A taxa padrão será preenchida automaticamente ao criar um novo empréstimo. Cada contrato
          pode ter sua própria taxa personalizada.
        </p>

        <div>
          <label className="mb-2 block text-sm font-medium text-content-soft">
            Taxa de juros padrão (%)
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={settings.defaultInterestRate}
              onChange={(e) => {
                const val = e.target.value;
                // Permite campo vazio durante edição
                if (val === '') {
                  updateSetting('defaultInterestRate', '');
                  return;
                }
                const num = parseFloat(val);
                if (!isNaN(num) && num >= 0 && num <= 100) {
                  updateSetting('defaultInterestRate', num);
                }
              }}
              onBlur={(e) => {
                // Se sair do campo vazio, volta ao padrão
                if (e.target.value === '' || isNaN(parseFloat(e.target.value))) {
                  updateSetting('defaultInterestRate', 10);
                }
              }}
              className="min-h-[44px] w-24 rounded-design-md border border-edge bg-surface-muted px-4 py-2 text-center text-lg font-semibold text-content tabular-nums"
            />
            <span className="text-sm font-medium text-content-muted">% ao mês</span>
          </div>
        </div>
      </div>

      {/* ===== SOBRE ===== */}
      <div className={sectionCardClass}>
        <h3 className="mb-3 text-lg font-semibold tracking-tight text-content">ℹ️ Sobre</h3>
        <div className="space-y-2 text-sm leading-relaxed text-content-muted">
          <p>
            <span className="font-medium text-content">Finanças Pro</span> — Controle de
            empréstimos pessoais
          </p>
          <p className="tabular-nums">Versão 2.0.0</p>
          <p className="border-t border-edge/60 pt-3 text-xs leading-relaxed text-content-muted">
            Dados financeiros salvos localmente neste aparelho. Faça backups regulares para não
            perder informações.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
