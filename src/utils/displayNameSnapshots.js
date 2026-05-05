/**
 * Helpers puros para normalização, validação e derivação de snapshots de nome de exibição
 * (links / loanRequests). Sem Firebase, sem I/O — ver ADR_IDENTIDADE_PUBLICA_SNAPSHOTS_NOMES.
 */

import {
  NEW_LOCAL_CLIENT_NAME_FROM_PLATFORM_LOAN_REQUEST,
  PLATFORM_SUPPLIER_DISPLAY_FALLBACK,
} from './platformFriendlyLabels';

/** Limite alinhado ao perfil (`users.displayName`) nas rules atuais. */
export const DISPLAY_NAME_SNAPSHOT_MAX_LEN = 80;

/**
 * Normaliza valor bruto para persistência como snapshot relacional.
 * - não-string → null
 * - trim; vazio → null
 * - mais de {@link DISPLAY_NAME_SNAPSHOT_MAX_LEN} caracteres → truncado aos primeiros 80 (decisão estável para escrita segura)
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeDisplayNameForSnapshot(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  if (t.length <= DISPLAY_NAME_SNAPSHOT_MAX_LEN) return t;
  return t.slice(0, DISPLAY_NAME_SNAPSHOT_MAX_LEN);
}

/**
 * Valida valor já pensado como snapshot armazenado (sem truncar).
 * - null aceitável (campo opcional / ausência semântica)
 * - string: deve ter 1–{@link DISPLAY_NAME_SNAPSHOT_MAX_LEN} caracteres após trim (sem só espaços)
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidDisplayNameSnapshot(value) {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  const t = value.trim();
  if (t.length === 0) return false;
  if (t.length > DISPLAY_NAME_SNAPSHOT_MAX_LEN) return false;
  return true;
}

/**
 * Resolve texto de exibição com ordem: snapshot normalizado → perfil normalizado → fallback textual → UID (modo debug).
 * UID só é usado quando `includeUid === true`, não há snapshot nem perfil válidos e `fallbackText` está vazio.
 *
 * @param {object} opts
 * @param {unknown} [opts.snapshot]
 * @param {unknown} [opts.profileDisplayName]
 * @param {string} [opts.fallbackText]
 * @param {boolean} [opts.includeUid]
 * @param {unknown} [opts.uid]
 * @returns {string}
 */
export function resolveDisplayNameWithFallback(opts = {}) {
  const snapshot = normalizeDisplayNameForSnapshot(opts.snapshot);
  if (snapshot !== null) return snapshot;

  const profile = normalizeDisplayNameForSnapshot(opts.profileDisplayName);
  if (profile !== null) return profile;

  const fb =
    typeof opts.fallbackText === 'string' ? opts.fallbackText : '';

  if (fb !== '') return fb;

  if (
    opts.includeUid === true &&
    typeof opts.uid === 'string' &&
    opts.uid.trim().length > 0
  ) {
    return opts.uid.trim();
  }

  return fb;
}

/**
 * Nome amigável do cliente num pedido remoto (snapshot → fallback de produto).
 *
 * @param {Record<string, unknown> | null | undefined} request
 * @returns {string}
 */
export function deriveLoanRequestClientFriendlyName(request) {
  const n = normalizeDisplayNameForSnapshot(
    request?.clientDisplayNameSnapshot,
  );
  return n ?? NEW_LOCAL_CLIENT_NAME_FROM_PLATFORM_LOAN_REQUEST;
}

/**
 * Nome amigável do fornecedor num vínculo aprovado (snapshot → perfil remoto → fallback de produto).
 * Sem usar UID como informação principal (`includeUid` desligado).
 *
 * @param {Record<string, unknown> | null | undefined} link
 * @param {unknown} [profileDisplayName] — `users.displayName` do fornecedor, quando já carregado
 * @returns {string}
 */
export function deriveApprovedLinkSupplierFriendlyName(link, profileDisplayName) {
  return resolveDisplayNameWithFallback({
    snapshot: link?.supplierDisplayNameSnapshot,
    profileDisplayName,
    fallbackText: PLATFORM_SUPPLIER_DISPLAY_FALLBACK,
    includeUid: false,
    uid: typeof link?.supplierId === 'string' ? link.supplierId : '',
  });
}

/**
 * Nome amigável do fornecedor num pedido remoto (snapshot → perfil remoto opcional → fallback de produto).
 *
 * @param {Record<string, unknown> | null | undefined} request
 * @param {unknown} [profileDisplayName] — `users.displayName` do fornecedor, quando já carregado
 * @returns {string}
 */
export function deriveLoanRequestSupplierFriendlyName(request, profileDisplayName) {
  return resolveDisplayNameWithFallback({
    snapshot: request?.supplierDisplayNameSnapshot,
    profileDisplayName,
    fallbackText: PLATFORM_SUPPLIER_DISPLAY_FALLBACK,
    includeUid: false,
    uid: typeof request?.supplierId === 'string' ? request.supplierId : '',
  });
}

/**
 * Extrai apenas campos de snapshot do documento (cópia rasa), sem mutar `record`.
 * Preserva ausência de chaves para merges compatíveis com documentos antigos.
 *
 * @param {Record<string, unknown> | null | undefined} record
 * @returns {{ clientDisplayNameSnapshot?: unknown, supplierDisplayNameSnapshot?: unknown }}
 */
export function pickSnapshotFields(record) {
  if (!record || typeof record !== 'object') return {};
  /** @type {{ clientDisplayNameSnapshot?: unknown, supplierDisplayNameSnapshot?: unknown }} */
  const out = {};
  if (Object.prototype.hasOwnProperty.call(record, 'clientDisplayNameSnapshot')) {
    out.clientDisplayNameSnapshot = record.clientDisplayNameSnapshot;
  }
  if (
    Object.prototype.hasOwnProperty.call(record, 'supplierDisplayNameSnapshot')
  ) {
    out.supplierDisplayNameSnapshot = record.supplierDisplayNameSnapshot;
  }
  return out;
}

/**
 * Normaliza apenas chaves presentes no patch (hasOwnProperty).
 * Valores viram `string | null` via {@link normalizeDisplayNameForSnapshot}.
 * Objetivo: atualização parcial sem apagar outras chaves do documento ao fazer merge manual.
 *
 * @param {Record<string, unknown> | null | undefined} patch
 * @returns {{ clientDisplayNameSnapshot?: string | null, supplierDisplayNameSnapshot?: string | null }}
 */
export function normalizeSnapshotPatch(patch) {
  if (!patch || typeof patch !== 'object') return {};
  /** @type {{ clientDisplayNameSnapshot?: string | null, supplierDisplayNameSnapshot?: string | null }} */
  const out = {};
  if (Object.prototype.hasOwnProperty.call(patch, 'clientDisplayNameSnapshot')) {
    out.clientDisplayNameSnapshot = normalizeDisplayNameForSnapshot(
      patch.clientDisplayNameSnapshot,
    );
  }
  if (
    Object.prototype.hasOwnProperty.call(patch, 'supplierDisplayNameSnapshot')
  ) {
    out.supplierDisplayNameSnapshot = normalizeDisplayNameForSnapshot(
      patch.supplierDisplayNameSnapshot,
    );
  }
  return out;
}

/**
 * Objeto parcial só com snapshots normalizados **não nulos** — útil quando não se quer gravar campo vazio.
 *
 * @param {Record<string, unknown>} [input]
 * @returns {{ clientDisplayNameSnapshot?: string, supplierDisplayNameSnapshot?: string }}
 */
export function buildDisplayNameSnapshotsPartial(input = {}) {
  /** @type {{ clientDisplayNameSnapshot?: string, supplierDisplayNameSnapshot?: string }} */
  const out = {};
  const normalized = normalizeSnapshotPatch(input);
  if (
    Object.prototype.hasOwnProperty.call(normalized, 'clientDisplayNameSnapshot') &&
    normalized.clientDisplayNameSnapshot !== null
  ) {
    out.clientDisplayNameSnapshot = normalized.clientDisplayNameSnapshot;
  }
  if (
    Object.prototype.hasOwnProperty.call(
      normalized,
      'supplierDisplayNameSnapshot',
    ) &&
    normalized.supplierDisplayNameSnapshot !== null
  ) {
    out.supplierDisplayNameSnapshot = normalized.supplierDisplayNameSnapshot;
  }
  return out;
}
