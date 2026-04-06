import React, { useState, useRef } from 'react';
import { formatDateTime } from '../utils/format';
import { getAutoBackupCount, getLastAutoBackup } from '../utils/autoBackup';

/**
 * Toggle switch reutilizável.
 */
const Toggle = ({ enabled, onToggle, label, description }) => (
  <div className="flex items-center justify-between py-2.5">
    <div className="flex-1 mr-4">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {description && <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>}
    </div>
    <button
      type="button"
      onClick={onToggle}
      className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
        enabled ? 'bg-blue-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
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
  <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
    {options.map((opt) => (
      <button
        key={opt.value}
        type="button"
        onClick={() => onChange(opt.value)}
        className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors ${
          value === opt.value ? 'bg-white shadow text-blue-600' : 'text-gray-500'
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
 */
const Settings = ({
  settings,
  onUpdateSettings,
  onExport,
  onImport,
  onRestoreAutoBackup,
  showToast,
}) => {
  const fileInputRef = useRef(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

  // Info de backups automáticos (lida direto do localStorage)
  const [backupInfo, setBackupInfo] = useState(() => ({
    count: getAutoBackupCount(),
    last: getLastAutoBackup(),
  }));

  const refreshBackupInfo = () => {
    setBackupInfo({
      count: getAutoBackupCount(),
      last: getLastAutoBackup(),
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

  return (
    <div className="p-4 space-y-4 pb-20">
      {/* ===== APARÊNCIA ===== */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">🎨 Aparência</h3>

        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">Tema</label>
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

      {/* ===== BACKUP E SEGURANÇA ===== */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-1">🔒 Backup e Segurança</h3>
        <p className="text-xs text-gray-500 mb-4">
          O backup automático salva uma cópia dos seus dados internamente no navegador a cada
          alteração importante.
        </p>

        <Toggle
          label="Backup automático"
          description="Cria cópia interna a cada alteração importante"
          enabled={settings.autoBackupEnabled}
          onToggle={() => updateSetting('autoBackupEnabled', !settings.autoBackupEnabled)}
        />

        {settings.autoBackupEnabled && (
          <div className="mt-2 mb-3">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
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
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 mt-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Backups armazenados:</span>
            <span className="font-bold text-gray-700">{backupInfo.count}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Último backup automático:</span>
            <span className="font-bold text-gray-700">
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
            className="w-full mt-3 bg-orange-50 text-orange-800 py-2.5 rounded-xl font-bold text-sm border border-orange-200 active:bg-orange-100"
          >
            🔄 Restaurar último backup automático
          </button>
        ) : (
          <div className="mt-3 bg-orange-50 p-4 rounded-xl border border-orange-200 text-center animate-fade-in">
            <p className="text-sm font-bold text-orange-800 mb-3">
              ⚠️ Isso vai substituir todos os dados atuais pelo último backup automático. Continuar?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmRestore(false)}
                className="flex-1 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleRestore}
                className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl font-bold text-sm"
              >
                Sim, Restaurar
              </button>
            </div>
          </div>
        )}

        {/* Backup manual */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-400 mb-2 uppercase">Backup Manual (Arquivo)</p>
          <div className="flex gap-2">
            <button
              onClick={onExport}
              className="flex-1 bg-blue-50 text-blue-800 py-2.5 rounded-xl font-bold text-sm border border-blue-200 active:bg-blue-100"
            >
              📥 Salvar Backup
            </button>
            <button
              onClick={() => fileInputRef.current.click()}
              className="flex-1 bg-gray-50 text-gray-800 py-2.5 rounded-xl font-bold text-sm border border-gray-200 active:bg-gray-100"
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
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">⚙️ Operação</h3>

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

        <div className="mt-4 pt-3 border-t border-gray-100">
          <label className="text-sm font-medium text-gray-700 mb-2 block">Aba inicial padrão</label>
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
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-1">💰 Financeiro</h3>
        <p className="text-xs text-gray-500 mb-4">
          A taxa padrão será preenchida automaticamente ao criar um novo empréstimo. Cada contrato
          pode ter sua própria taxa personalizada.
        </p>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Taxa de juros padrão (%)
          </label>
          <div className="flex items-center gap-3">
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
              className="w-24 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-center font-bold text-lg"
            />
            <span className="text-gray-500 font-medium">% ao mês</span>
          </div>
        </div>
      </div>

      {/* ===== SOBRE ===== */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-2">ℹ️ Sobre</h3>
        <div className="space-y-1 text-sm text-gray-500">
          <p>
            <span className="font-medium text-gray-700">Finanças Pro</span> — Controle de
            empréstimos pessoais
          </p>
          <p>Versão 2.0.0</p>
          <p className="text-xs text-gray-400 mt-2">
            Dados salvos localmente no navegador. Faça backups regulares para não perder informações.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
