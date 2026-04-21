/**
 * Mapeia erros do Firebase Auth para mensagens curtas em português (UI).
 * Usa `code` quando disponível; nunca repassa mensagens brutas do SDK.
 */

const AUTH_ERROR_MESSAGES_PT = {
  'auth/invalid-email': 'E-mail inválido.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
  'auth/email-already-in-use': 'Este e-mail já está em uso. Tente entrar.',
  'auth/weak-password': 'Senha muito fraca. Use uma senha mais forte.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde um momento e tente de novo.',
  'auth/network-request-failed': 'Sem conexão. Verifique a internet.',
  'auth/operation-not-allowed': 'Este tipo de acesso não está habilitado.',
  'auth/requires-recent-login': 'Por segurança, saia e entre novamente.',
  'auth/popup-closed-by-user': 'Login cancelado.',
  'auth/cancelled-popup-request': 'Login cancelado.',
  'auth/internal-error': 'Erro temporário. Tente novamente em instantes.',
  'auth/invalid-continue-uri': 'Configuração de recuperação inválida. Tente novamente mais tarde.',
};

const DEFAULT_MESSAGE = 'Não foi possível concluir. Tente novamente.';

/**
 * @param {unknown} error
 * @returns {string}
 */
export function mapFirebaseAuthError(error) {
  const code =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : null;

  if (code && AUTH_ERROR_MESSAGES_PT[code]) {
    return AUTH_ERROR_MESSAGES_PT[code];
  }

  return DEFAULT_MESSAGE;
}
