/**
 * Mensagens curtas para erros comuns do Firestore na UI (sem expor detalhes internos).
 */

const FIRESTORE_ERROR_MESSAGES_PT = {
  'permission-denied': 'Sem permissão para salvar. Verifique se você está conectado.',
  'unavailable': 'Serviço temporariamente indisponível. Tente novamente.',
  'deadline-exceeded': 'A operação demorou demais. Tente novamente.',
  'failed-precondition': 'Não foi possível concluir. Tente novamente.',
  'not-found': 'Dados não encontrados.',
};

const DEFAULT_MESSAGE = 'Não foi possível salvar. Tente novamente.';

// Depois do pré-check em createLinkRequest (perfis e papéis), permission-denied indica
// regra/payload/projeto, não “UID errado” — mensagem mais curta e direta.
const LINK_PERMISSION_DENIED_PT =
  'O servidor negou o pedido após conferir perfis. Confira se o app usa o mesmo projeto Firebase do console, se as regras publicadas incluem vínculos e tente de novo. Se já existe vínculo, a mensagem costuma ser outra.';

const LINK_NOT_FOUND_PT =
  'Registro não encontrado. O vínculo pode ter mudado em outro aparelho — recarregue a lista (saia e volte a Conta, se precisar).';

const LINK_FAILED_PRECONDITION_PT =
  'Não foi possível concluir agora por uma condição do servidor. Tente de novo em instantes.';

/**
 * @param {unknown} error
 * @returns {string | null}
 */
export function normalizeFirestoreErrorCode(error) {
  const code =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : null;

  if (!code) {
    return null;
  }

  if (code === 'permission-denied' || code.endsWith('/permission-denied')) {
    return 'permission-denied';
  }
  if (code === 'not-found' || code.endsWith('/not-found')) {
    return 'not-found';
  }
  if (code === 'failed-precondition' || code.endsWith('/failed-precondition')) {
    return 'failed-precondition';
  }
  if (code === 'unavailable' || code.endsWith('/unavailable')) {
    return 'unavailable';
  }
  if (code === 'deadline-exceeded' || code.endsWith('/deadline-exceeded')) {
    return 'deadline-exceeded';
  }

  return code;
}

/**
 * Mensagens mais úteis para criar ou atualizar documentos em `links` (smoke / depuração).
 *
 * @param {unknown} error
 * @returns {string}
 */
export function mapLinkFirestoreError(error) {
  const normalized = normalizeFirestoreErrorCode(error);

  switch (normalized) {
    case 'permission-denied':
      return LINK_PERMISSION_DENIED_PT;
    case 'not-found':
      return LINK_NOT_FOUND_PT;
    case 'failed-precondition':
      return LINK_FAILED_PRECONDITION_PT;
    case 'unavailable':
    case 'deadline-exceeded':
      return (
        FIRESTORE_ERROR_MESSAGES_PT[normalized] ??
        FIRESTORE_ERROR_MESSAGES_PT.unavailable
      );
    default:
      return mapFirestoreError(error);
  }
}

/**
 * Heurística para colagem do UID do Firebase Auth (evita e-mail e texto claramente errados).
 *
 * @param {unknown} value
 */
export function looksLikeFirebaseUid(value) {
  const s = String(value ?? '').trim();
  if (!s || /\s/.test(s) || s.includes('@')) {
    return false;
  }
  return /^[a-zA-Z0-9]{20,128}$/.test(s);
}

/**
 * @param {string} supplierUidRaw
 * @param {string} clientUid
 * @returns {string | null} mensagem de validação ou null se ok
 */
export function describeInvalidSupplierUidForLink(supplierUidRaw, clientUid) {
  const sid = String(supplierUidRaw ?? '').trim();
  if (!sid) {
    return 'Informe o UID do fornecedor.';
  }
  if (sid === clientUid) {
    return 'Use o UID da outra conta (fornecedor), não o seu.';
  }
  if (sid.includes('@')) {
    return 'Isso parece um e-mail. Para o vínculo, use o UID da conta (letras e números), que aparece em Conta neste app.';
  }
  if (/\s/.test(String(supplierUidRaw ?? ''))) {
    return 'Remova espaços extras no UID.';
  }
  if (!looksLikeFirebaseUid(sid)) {
    return 'O texto não parece um UID completo. Copie o identificador em Conta → Seu identificador (UID) na outra conta.';
  }
  return null;
}

/**
 * @param {unknown} error
 * @returns {string}
 */
export function mapFirestoreError(error) {
  const normalized = normalizeFirestoreErrorCode(error);

  if (normalized && FIRESTORE_ERROR_MESSAGES_PT[normalized]) {
    return FIRESTORE_ERROR_MESSAGES_PT[normalized];
  }

  const legacyCode =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : null;

  if (legacyCode && FIRESTORE_ERROR_MESSAGES_PT[legacyCode]) {
    return FIRESTORE_ERROR_MESSAGES_PT[legacyCode];
  }

  return DEFAULT_MESSAGE;
}
