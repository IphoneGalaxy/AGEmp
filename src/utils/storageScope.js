/**
 * Escopo de armazenamento local: particiona dados no mesmo navegador.
 *
 * Escopos mínimos: `anonymous` e `account:{uid}`.
 * Dados e backups seguem o escopo; preferências de aparência ficam no dispositivo.
 */

export const SCOPE_ANONYMOUS = 'anonymous';

/**
 * @param {import('firebase/auth').User | null} user
 * @returns {string}
 */
export function getActiveStorageScope(user) {
  if (user?.uid) {
    return `account:${user.uid}`;
  }
  return SCOPE_ANONYMOUS;
}

/** Chaves de legado (pré-escopos), sem sufixo. */
export const LEGACY_KEYS = {
  data: 'loanManagerData',
  settings: 'loanManagerSettings',
  autoBackups: 'loanManagerAutoBackups',
};

/** Metadado local por escopo — não faz parte do backup TXT principal (`loanManagerData`). */
export const LOCAL_META_KEYS = Object.freeze({
  convertedLoanRequestsRegistry: 'financasPro_convertedLoanRequestsRegistry',
  clientDebtLedger: 'financasPro_clientDebtLedger',
});

/**
 * @param {string} scope
 * @returns {string}
 */
export function getScopedConvertedLoanRequestsRegistryKey(scope) {
  return `${LOCAL_META_KEYS.convertedLoanRequestsRegistry}:${scope}`;
}

/**
 * @param {string} scope
 * @returns {string}
 */
export function getScopedClientDebtLedgerKey(scope) {
  return `${LOCAL_META_KEYS.clientDebtLedger}:${scope}`;
}

const DEVICE_SETTINGS_KEY = 'financasPro_deviceSettings';

/** Registro de decisão do usuário sobre legado anônimo x conta. */
const LEGACY_CHOICE_KEY = 'financasPro_legacyByAccount';

/**
 * Garante que dados antigos (chaves sem escopo) existam no escopo `anonymous`.
 * Idempotente. Deve ser chamada antes de qualquer leitura escopada.
 */
export function migrateLegacyKeysToAnonymousScope() {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const dataScoped = getScopedDataKey(SCOPE_ANONYMOUS);
  const settingsScoped = getScopedSettingsKey(SCOPE_ANONYMOUS);
  const autoScoped = getScopedAutoBackupsKey(SCOPE_ANONYMOUS);

  // loanManagerData
  if (localStorage.getItem(LEGACY_KEYS.data) != null) {
    if (localStorage.getItem(dataScoped) == null) {
      localStorage.setItem(dataScoped, localStorage.getItem(LEGACY_KEYS.data));
    }
    localStorage.removeItem(LEGACY_KEYS.data);
  }

  // loanManagerSettings: migrar tudo para escopo anônimo; depois loadSettings reparte device/escopado
  if (localStorage.getItem(LEGACY_KEYS.settings) != null) {
    if (localStorage.getItem(settingsScoped) == null) {
      localStorage.setItem(settingsScoped, localStorage.getItem(LEGACY_KEYS.settings));
    }
    localStorage.removeItem(LEGACY_KEYS.settings);
  }

  if (localStorage.getItem(LEGACY_KEYS.autoBackups) != null) {
    if (localStorage.getItem(autoScoped) == null) {
      localStorage.setItem(autoScoped, localStorage.getItem(LEGACY_KEYS.autoBackups));
    }
    localStorage.removeItem(LEGACY_KEYS.autoBackups);
  }
}

/**
 * @param {string} scope
 * @returns {string}
 */
export function getScopedDataKey(scope) {
  return `${LEGACY_KEYS.data}:${scope}`;
}

/**
 * @param {string} scope
 * @returns {string}
 */
export function getScopedSettingsKey(scope) {
  return `${LEGACY_KEYS.settings}:${scope}`;
}

/**
 * @param {string} scope
 * @returns {string}
 */
export function getScopedAutoBackupsKey(scope) {
  return `${LEGACY_KEYS.autoBackups}:${scope}`;
}

// --- Apenas aparência / conforto (compartilhado no aparelho) ---
const DEVICE_UI_KEYS = ['theme', 'reduceAnimations', 'hideSensitiveValues'];

/**
 * @returns {Record<string, unknown>}
 */
export function loadDeviceUiSettings() {
  try {
    const raw = localStorage.getItem(DEVICE_SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

/**
 * @param {Record<string, unknown>} fullSettings
 * @returns {void}
 */
export function saveDeviceUiFromFullSettings(fullSettings) {
  const device = {};
  for (const k of DEVICE_UI_KEYS) {
    if (k in fullSettings) {
      device[k] = fullSettings[k];
    }
  }
  try {
    localStorage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify(device));
  } catch {
    // Quota: melhor do que derrubar o app
  }
}

/**
 * @returns {void}
 */
export function stripDeviceKeysFromScopedPayloadInPlace(draft) {
  for (const k of DEVICE_UI_KEYS) {
    delete draft[k];
  }
}

/**
 * Lê o mapa de decisões de legado por uid.
 * @returns {Record<string, 'associated' | 'separate'>}
 */
export function getLegacyDecisions() {
  try {
    const raw = localStorage.getItem(LEGACY_CHOICE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

/**
 * @param {string} uid
 * @param {'associated' | 'separate'} decision
 */
export function setLegacyDecision(uid, decision) {
  if (!uid) return;
  const next = { ...getLegacyDecisions(), [uid]: decision };
  try {
    localStorage.setItem(LEGACY_CHOICE_KEY, JSON.stringify(next));
  } catch {
    // noop
  }
}

/**
 * @param {string} uid
 * @returns {'associated' | 'separate' | undefined}
 */
export function getLegacyDecision(uid) {
  if (!uid) return undefined;
  return getLegacyDecisions()[uid];
}

/**
 * @param {string} scope
 * @param {string} rawJson
 * @returns {{ fundsTransactions: Array, clients: Array } | null}
 */
function parseDataPayload(rawJson) {
  if (rawJson == null) return null;
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      fundsTransactions: Array.isArray(parsed.fundsTransactions) ? parsed.fundsTransactions : [],
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
    };
  } catch {
    return null;
  }
}

/**
 * Dados "presentes" no escopo: qualquer transação, cliente, ou chave inexistente com payload não vazio legado mínimo.
 * @param {string} scope
 * @returns {boolean}
 */
export function scopeHasFinancialData(scope) {
  if (typeof localStorage === 'undefined') return false;
  const key = getScopedDataKey(scope);
  const raw = localStorage.getItem(key);
  if (raw == null) return false;
  const p = parseDataPayload(raw);
  if (!p) return true;
  return p.clients.length > 0 || p.fundsTransactions.length > 0;
}

/**
 * Conta autenticada, sem dataset próprio, com legado anônimo pendente de decisão.
 * @param {string | null | undefined} uid
 * @returns {boolean}
 */
export function shouldPromptLegacyOnLogin(uid) {
  if (!uid) return false;
  if (getLegacyDecision(uid)) return false;
  if (scopeHasFinancialData(SCOPE_ANONYMOUS)) {
    if (!scopeHasFinancialData(`account:${uid}`)) {
      return true;
    }
  }
  return false;
}

/**
 * Copia o escopo anônimo completo (dados, settings escopados, fila de auto-backup) para a conta.
 * Limpa o escopo anônimo após sucesso.
 * @param {string} accountUid
 */
export function associateAnonymousDataWithAccount(accountUid) {
  if (!accountUid) {
    return;
  }
  const from = SCOPE_ANONYMOUS;
  const to = `account:${accountUid}`;

  const pairKeys = [
    [getScopedDataKey(from), getScopedDataKey(to)],
    [getScopedSettingsKey(from), getScopedSettingsKey(to)],
    [getScopedAutoBackupsKey(from), getScopedAutoBackupsKey(to)],
    [
      getScopedConvertedLoanRequestsRegistryKey(from),
      getScopedConvertedLoanRequestsRegistryKey(to),
    ],
    [getScopedClientDebtLedgerKey(from), getScopedClientDebtLedgerKey(to)],
  ];
  for (const [a, b] of pairKeys) {
    const v = localStorage.getItem(a);
    if (v != null) {
      try {
        localStorage.setItem(b, v);
      } catch (e) {
        console.warn('[scope] Falha ao copiar para conta:', b, e);
        throw e;
      }
    }
  }

  // Limpa anônimo: dados e backups; settings escopados deixam de existir
  try {
    localStorage.removeItem(getScopedDataKey(from));
    localStorage.removeItem(getScopedSettingsKey(from));
    localStorage.removeItem(getScopedAutoBackupsKey(from));
    localStorage.removeItem(getScopedConvertedLoanRequestsRegistryKey(from));
    localStorage.removeItem(getScopedClientDebtLedgerKey(from));
  } catch {
    // noop
  }

  setLegacyDecision(accountUid, 'associated');
}

/**
 * @param {string} accountUid
 */
export function markKeepLegacySeparate(accountUid) {
  if (accountUid) {
    setLegacyDecision(accountUid, 'separate');
  }
}
