import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { mapFirestoreError } from '../firebase/firestoreErrors';
import {
  ensureUserProfileExists,
  getUserProfile,
  updateUserDisplayNameWithAuthMirror,
} from '../firebase/users';

const sectionCardClass =
  'rounded-design-lg border border-edge bg-surface p-5 shadow-design-sm sm:p-6';

/**
 * Controles segmentados (mesmo padrão visual de Settings).
 */
const ModeToggle = ({ mode, onModeChange }) => (
  <div
    className="flex gap-0.5 rounded-design-md bg-surface-muted p-1 ring-1 ring-inset ring-edge/50"
    role="tablist"
    aria-label="Modo de acesso"
  >
    <button
      type="button"
      role="tab"
      aria-selected={mode === 'login'}
      onClick={() => onModeChange('login')}
      className={`flex min-h-10 flex-1 items-center justify-center rounded-design-sm px-2 text-xs font-semibold transition-colors ${
        mode === 'login'
          ? 'bg-surface text-primary shadow-design-sm ring-1 ring-edge/40'
          : 'text-content-muted hover:text-content-soft'
      }`}
    >
      Entrar
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={mode === 'signup'}
      onClick={() => onModeChange('signup')}
      className={`flex min-h-10 flex-1 items-center justify-center rounded-design-sm px-2 text-xs font-semibold transition-colors ${
        mode === 'signup'
          ? 'bg-surface text-primary shadow-design-sm ring-1 ring-edge/40'
          : 'text-content-muted hover:text-content-soft'
      }`}
    >
      Criar conta
    </button>
  </div>
);

/**
 * Tela isolada de conta (Firebase Auth — e-mail/senha).
 * Não altera persistência local nem domínio financeiro.
 * Verificação de e-mail (gate / sendEmailVerification): fora de escopo nesta rodada.
 *
 * @param {Object} props
 * @param {() => void} props.onBack — Volta à lista de configurações.
 * @param {(msg: string) => void} [props.showToast]
 */
function AccountScreen({ onBack, showToast }) {
  const { user, authReady, authAvailable, login, signup, logout, requestPasswordReset } =
    useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [passwordResetMessage, setPasswordResetMessage] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const [remoteProfile, setRemoteProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileLoadToken, setProfileLoadToken] = useState(0);

  useEffect(() => {
    if (!user?.uid || !authAvailable) {
      setRemoteProfile(null);
      setDisplayNameInput('');
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
          setDisplayNameInput(
            data?.displayName != null ? String(data.displayName) : ''
          );
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
    // user é lido no fechamento; user?.uid e profileLoadToken disparam recargas necessárias.
  }, [user?.uid, authAvailable, profileLoadToken]);

  const resetForm = () => {
    setPassword('');
    setConfirmPassword('');
    setError('');
    setPasswordResetMessage('');
  };

  const handleModeChange = (next) => {
    setMode(next);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setPasswordResetMessage('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Informe o e-mail.');
      return;
    }
    if (!password) {
      setError('Informe a senha.');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setSubmitting(true);
    try {
      const result =
        mode === 'login'
          ? await login(trimmedEmail, password)
          : await signup(trimmedEmail, password);
      if (result.ok) {
        resetForm();
        setEmail('');
        showToast?.(
          mode === 'login' ? 'Sessão iniciada com sucesso.' : 'Conta criada. Você já está conectado.'
        );
      } else {
        setError(result.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    setError('');
    setPasswordResetMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Informe o e-mail para enviar a recuperação.');
      return;
    }

    setResettingPassword(true);
    try {
      const result = await requestPasswordReset(trimmedEmail);
      if (result.ok) {
        setPasswordResetMessage(
          'Se este e-mail estiver cadastrado, enviaremos o link de recuperação em instantes. Confira também a pasta de spam.'
        );
      } else {
        setError(result.message);
      }
    } finally {
      setResettingPassword(false);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!user?.uid) return;

    const next = displayNameInput.trim();
    const prev =
      remoteProfile?.displayName != null
        ? String(remoteProfile.displayName).trim()
        : '';

    if (next === prev) {
      showToast?.('Nenhuma alteração para salvar.');
      return;
    }

    setProfileError('');
    setSavingProfile(true);
    try {
      const result = await updateUserDisplayNameWithAuthMirror(user, next);
      if (result.ok) {
        const data = await getUserProfile(user.uid);
        setRemoteProfile(data);
        setDisplayNameInput(
          data?.displayName != null ? String(data.displayName) : ''
        );
        if (result.authSyncFailed) {
          showToast?.(
            result.message
              ? `Nome salvo. Não deu para sincronizar o login: ${result.message}`
              : 'Nome salvo. O login não foi totalmente sincronizado.'
          );
        } else {
          showToast?.('Nome do perfil salvo.');
        }
      } else {
        setProfileError(result.message);
      }
    } catch (e) {
      setProfileError(mapFirestoreError(e));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    setError('');
    setSubmitting(true);
    try {
      const result = await logout();
      if (result.ok) {
        resetForm();
        setEmail('');
        showToast?.('Você saiu da conta.');
      } else {
        setError(result.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 pb-20">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-design-md text-sm font-semibold text-primary transition-colors hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          aria-label="Voltar às configurações"
        >
          ←
        </button>
        <h2 className="text-lg font-semibold tracking-tight text-content">Conta</h2>
      </div>

      <p className="text-xs leading-relaxed text-content-muted">
        Login opcional. Seus dados no aparelho continuam apenas locais até futuras etapas de
        sincronização.
      </p>

      {!authReady ? (
        <div className={sectionCardClass}>
          <p className="text-center text-sm font-medium text-content-muted">Carregando…</p>
          <p className="mt-2 text-center text-xs text-content-muted">
            Verificando estado da sessão.
          </p>
        </div>
      ) : !authAvailable ? (
        <div className={sectionCardClass}>
          <h3 className="mb-2 text-base font-semibold text-content">Conta indisponível</h3>
          <p className="text-sm leading-relaxed text-content-muted">
            Este ambiente não tem o Firebase configurado. O app continua funcionando normalmente
            no modo local.
          </p>
        </div>
      ) : user ? (
        <div className="space-y-6">
          <div className={sectionCardClass}>
            <h3 className="mb-1 text-base font-semibold text-content">Perfil remoto</h3>
            <p className="mb-5 text-xs leading-relaxed text-content-muted">
              Nome exibido na sua conta na nuvem. Não altera dados financeiros neste aparelho.
            </p>

            {profileLoading ? (
              <p className="text-center text-sm text-content-muted">Carregando perfil…</p>
            ) : profileError ? (
              <div
                className="rounded-design-md border border-edge bg-danger-soft px-4 py-3 text-center"
                role="alert"
              >
                <p className="mb-4 text-sm font-semibold leading-snug text-danger">{profileError}</p>
                <button
                  type="button"
                  onClick={() => setProfileLoadToken((t) => t + 1)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                >
                  Tentar novamente
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="profile-display-name"
                    className="mb-2 block text-sm font-medium text-content-soft"
                  >
                    Nome no perfil
                  </label>
                  <input
                    id="profile-display-name"
                    type="text"
                    autoComplete="name"
                    maxLength={80}
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    className="min-h-[44px] w-full rounded-design-md border border-edge bg-surface-muted px-4 py-2 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                    placeholder="Como quer ser chamado"
                  />
                  <p className="mt-1.5 text-xs text-content-muted">
                    Máximo de 80 caracteres. Deixe em branco se preferir.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveDisplayName}
                  disabled={savingProfile || profileLoading}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md bg-primary px-4 text-sm font-semibold text-content-inverse shadow-design-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                >
                  {savingProfile ? 'Salvando…' : 'Salvar nome'}
                </button>
              </div>
            )}
          </div>

          <div className={sectionCardClass}>
            <h3 className="mb-3 text-base font-semibold text-content">Sessão ativa</h3>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-content-muted">
              E-mail
            </p>
            <p className="mb-6 break-all text-sm font-medium text-content">{user.email}</p>
            <button
              type="button"
              onClick={handleLogout}
              disabled={submitting}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface-muted text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 disabled:opacity-60"
            >
              {submitting ? 'Saindo…' : 'Sair da conta'}
            </button>
          </div>
        </div>
      ) : (
        <div className={sectionCardClass}>
          <ModeToggle mode={mode} onModeChange={handleModeChange} />

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div
                className="rounded-design-md border border-edge bg-danger-soft px-4 py-3 text-center"
                role="alert"
              >
                <p className="text-sm font-semibold leading-snug text-danger">{error}</p>
              </div>
            )}

            {passwordResetMessage && (
              <div
                className="rounded-design-md border border-success/40 bg-success-soft px-4 py-3 text-center"
                role="status"
              >
                <p className="text-sm font-medium leading-relaxed text-success">{passwordResetMessage}</p>
              </div>
            )}

            <div>
              <label htmlFor="account-email" className="mb-2 block text-sm font-medium text-content-soft">
                E-mail
              </label>
              <input
                id="account-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-[44px] w-full rounded-design-md border border-edge bg-surface-muted px-4 py-2 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
              />
            </div>

            <div>
              <label htmlFor="account-password" className="mb-2 block text-sm font-medium text-content-soft">
                Senha
              </label>
              <input
                id="account-password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-[44px] w-full rounded-design-md border border-edge bg-surface-muted px-4 py-2 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
              />
              {mode === 'login' && (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={resettingPassword || submitting}
                    className="inline-flex min-h-[44px] items-center text-sm font-semibold text-primary underline-offset-2 transition-colors hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resettingPassword ? 'Enviando…' : 'Esqueci minha senha'}
                  </button>
                </div>
              )}
            </div>

            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="account-confirm"
                  className="mb-2 block text-sm font-medium text-content-soft"
                >
                  Confirmar senha
                </label>
                <input
                  id="account-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="min-h-[44px] w-full rounded-design-md border border-edge bg-surface-muted px-4 py-2 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md bg-primary px-4 text-sm font-semibold text-content-inverse shadow-design-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
            >
              {submitting
                ? 'Aguarde…'
                : mode === 'login'
                  ? 'Entrar'
                  : 'Criar conta'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default AccountScreen;
