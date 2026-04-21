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

/**
 * @param {unknown} error
 * @returns {string}
 */
export function mapFirestoreError(error) {
  const code =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : null;

  if (code && FIRESTORE_ERROR_MESSAGES_PT[code]) {
    return FIRESTORE_ERROR_MESSAGES_PT[code];
  }

  return DEFAULT_MESSAGE;
}
