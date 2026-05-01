import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  describeInvalidSupplierUidForLink,
  mapFirestoreError,
  mapLinkFirestoreError,
} from '../firebase/firestoreErrors';
import {
  createLinkRequest,
  getLinkStatusLabelPt,
  LINK_STATUSES,
  listUserLinks,
  transitionLinkStatus,
} from '../firebase/links';
import {
  USER_ROLES,
  getEffectiveAccountRoles,
  hasAnyEffectiveAccountRole,
  profileHasEffectiveAccountRole,
} from '../firebase/roles';
import {
  addAccountRole,
  ensureUserProfileExists,
  getUserProfile,
  setUserRole,
  updateUserDisplayNameWithAuthMirror,
} from '../firebase/users';
import LoanRequestsClientPanel from './LoanRequestsClientPanel';
import LoanRequestsSupplierPanel from './LoanRequestsSupplierPanel';

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

  const [roleDraft, setRoleDraft] = useState(USER_ROLES.SUPPLIER);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState('');
  /** Contexto de UI apenas: alterna textos/ações globais de vínculo quando a conta tem os dois papéis. */
  const [accountView, setAccountView] = useState(USER_ROLES.CLIENT);
  const [addRoleSaving, setAddRoleSaving] = useState(false);

  const [links, setLinks] = useState([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState('');
  const [linksReloadToken, setLinksReloadToken] = useState(0);

  const [supplierUidForLink, setSupplierUidForLink] = useState('');
  const [linkRequestSubmitting, setLinkRequestSubmitting] = useState(false);
  const [linkRequestError, setLinkRequestError] = useState('');
  const [linkActionId, setLinkActionId] = useState(null);
  const [uidCopyFeedback, setUidCopyFeedback] = useState('idle');
  /** 'main' | 'loanRequests' (cliente) | 'loanRequestsSupplier' — fluxo isolado sem nova aba principal. */
  const [accountSubView, setAccountSubView] = useState('main');

  const bumpLinksReload = () => setLinksReloadToken((t) => t + 1);

  useEffect(() => {
    if (!user) {
      setAccountSubView('main');
    }
  }, [user]);

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

  useEffect(() => {
    const roles = getEffectiveAccountRoles(remoteProfile);
    if (roles.length === 0) {
      return;
    }
    if (roles.length === 1) {
      setAccountView(roles[0]);
      return;
    }
    setAccountView((prev) => (roles.includes(prev) ? prev : roles[0]));
  }, [remoteProfile]);

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

  const handleConfirmRole = async () => {
    if (!user?.uid) return;

    setRoleError('');
    setRoleSaving(true);
    try {
      const result = await setUserRole(user.uid, roleDraft);
      if (result.ok) {
        const data = await getUserProfile(user.uid);
        setRemoteProfile(data);
        showToast?.('Papel da conta definido com sucesso.');
        bumpLinksReload();
      } else {
        setRoleError(result.message);
        showToast?.(result.message);
      }
    } catch (e) {
      const msg = mapFirestoreError(e);
      setRoleError(msg);
      showToast?.(msg);
    } finally {
      setRoleSaving(false);
    }
  };

  const handleAddSecondAccountRole = async () => {
    if (!user?.uid) return;

    const roles = getEffectiveAccountRoles(remoteProfile);
    if (roles.length !== 1) return;

    const roleToAdd =
      roles[0] === USER_ROLES.CLIENT ? USER_ROLES.SUPPLIER : USER_ROLES.CLIENT;

    setAddRoleSaving(true);
    try {
      const result = await addAccountRole(user.uid, roleToAdd);
      if (result.ok) {
        const data = await getUserProfile(user.uid);
        setRemoteProfile(data);
        showToast?.(
          roleToAdd === USER_ROLES.SUPPLIER
            ? 'Papel Fornecedor (conta) habilitado na nuvem.'
            : 'Papel Cliente (conta) habilitado na nuvem.'
        );
        bumpLinksReload();
      } else {
        showToast?.(result.message);
      }
    } catch (e) {
      showToast?.(mapFirestoreError(e));
    } finally {
      setAddRoleSaving(false);
    }
  };

  const handleCreateLinkRequest = async () => {
    if (!user?.uid) return;

    setLinkRequestError('');
    const invalid = describeInvalidSupplierUidForLink(supplierUidForLink, user.uid);
    if (invalid) {
      setLinkRequestError(invalid);
      return;
    }

    const sid = supplierUidForLink.trim();

    setLinkRequestSubmitting(true);
    try {
      const result = await createLinkRequest({ supplierId: sid, clientId: user.uid });
      if (result.ok) {
        showToast?.('Pedido de vínculo enviado.');
        setSupplierUidForLink('');
        setLinkRequestError('');
        bumpLinksReload();
      } else {
        setLinkRequestError(result.message);
      }
    } catch (e) {
      setLinkRequestError(mapLinkFirestoreError(e));
    } finally {
      setLinkRequestSubmitting(false);
    }
  };

  const handleCopyMyUid = async () => {
    if (!user?.uid) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(user.uid);
        setUidCopyFeedback('copied');
        showToast?.('UID copiado.');
        window.setTimeout(() => setUidCopyFeedback('idle'), 2000);
      } else {
        throw new Error('clipboard-unavailable');
      }
    } catch {
      setUidCopyFeedback('failed');
      showToast?.(
        'Não foi possível copiar automaticamente. Selecione o UID acima e copie manualmente.'
      );
      window.setTimeout(() => setUidCopyFeedback('idle'), 3500);
    }
  };

  /** @param {'supplier' | 'client'} actorRole */
  const handleLinkTransition = async (link, nextStatus, actorRole) => {
    if (!link?.supplierId || !link?.clientId) return;

    setLinkActionId(link.id);
    try {
      const result = await transitionLinkStatus({
        supplierId: link.supplierId,
        clientId: link.clientId,
        actorRole,
        currentStatus: link.status,
        nextStatus,
      });
      if (result.ok) {
        showToast?.('Vínculo atualizado.');
      } else {
        showToast?.(result.message);
      }
      bumpLinksReload();
    } catch (e) {
      showToast?.(mapLinkFirestoreError(e));
      bumpLinksReload();
    } finally {
      setLinkActionId(null);
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

  const profileExtrasReady = !profileLoading && !profileError;
  const effectiveAccountRoles = getEffectiveAccountRoles(remoteProfile);
  const hasPlatformRole = hasAnyEffectiveAccountRole(remoteProfile);
  const canActAsClient = profileHasEffectiveAccountRole(remoteProfile, USER_ROLES.CLIENT);
  const canActAsSupplier = profileHasEffectiveAccountRole(remoteProfile, USER_ROLES.SUPPLIER);
  const dualAccountCapabilities = canActAsClient && canActAsSupplier;
  const linkGlobalBusy =
    linkActionId !== null ||
    linkRequestSubmitting ||
    roleSaving ||
    addRoleSaving;

  if (authReady && authAvailable && user && accountSubView === 'loanRequestsSupplier') {
    return (
      <div className="space-y-6 p-4 pb-20">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAccountSubView('main')}
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-design-md text-sm font-semibold text-primary transition-colors hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
            aria-label="Voltar à conta"
          >
            ←
          </button>
          <h2 className="text-lg font-semibold tracking-tight text-content">Pedidos recebidos</h2>
        </div>
        <p className="text-xs leading-relaxed text-content-muted">
          Respostas na plataforma entre contas. Isso não cria contrato nem altera financeiro local.
        </p>
        <LoanRequestsSupplierPanel user={user} showToast={showToast} />
      </div>
    );
  }

  if (authReady && authAvailable && user && accountSubView === 'loanRequests') {
    return (
      <div className="space-y-6 p-4 pb-20">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAccountSubView('main')}
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-design-md text-sm font-semibold text-primary transition-colors hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
            aria-label="Voltar à conta"
          >
            ←
          </button>
          <h2 className="text-lg font-semibold tracking-tight text-content">Solicitações</h2>
        </div>
        <p className="text-xs leading-relaxed text-content-muted">
          Pedidos na plataforma entre contas. Não confunda com contratos ou caixa do app — seu
          financeiro continua só neste aparelho.
        </p>
        <LoanRequestsClientPanel
          user={user}
          showToast={showToast}
          links={links}
          linksLoading={linksLoading}
        />
      </div>
    );
  }

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
        Login opcional. A conta identifica você e seus vínculos; empréstimos, caixa e backups
        continuam locais neste aparelho.
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
            Este ambiente não tem o Firebase configurado. O app continua funcionando no modo local,
            sem conta.
          </p>
        </div>
      ) : user ? (
        <div className="space-y-6">
          <div className={sectionCardClass}>
            <h3 className="mb-1 text-base font-semibold text-content">Seu identificador (UID)</h3>
            <p className="mb-4 text-xs leading-relaxed text-content-muted">
              Código da sua conta para criar vínculos com outras contas. Ele não é o e-mail e não dá
              acesso aos seus dados financeiros locais.
            </p>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-content-muted">
              Seu UID
            </p>
            <p className="mb-3 break-all font-mono text-sm font-medium text-content">{user.uid}</p>
            <button
              type="button"
              onClick={handleCopyMyUid}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface-muted px-4 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
            >
              {uidCopyFeedback === 'copied'
                ? 'Copiado'
                : uidCopyFeedback === 'failed'
                  ? 'Tentar copiar de novo'
                  : 'Copiar UID'}
            </button>
          </div>

          <div className={sectionCardClass}>
            <h3 className="mb-1 text-base font-semibold text-content">Identidade da conta</h3>
            <p className="mb-5 text-xs leading-relaxed text-content-muted">
              Nome usado na sua conta online. Não altera empréstimos, caixa ou backups deste
              aparelho.
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

          {profileExtrasReady && (
            <>
              <div className={sectionCardClass}>
                <h3 className="mb-1 text-base font-semibold text-content">Papel na plataforma</h3>
                <p className="mb-5 text-xs leading-relaxed text-content-muted">
                  Define como esta conta pode participar de vínculos. Isso não muda os clientes
                  cadastrados no financeiro local.
                </p>

                {hasPlatformRole ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-content">
                      Papéis habilitados (conta):{' '}
                      {effectiveAccountRoles
                        .map((r) =>
                          r === USER_ROLES.SUPPLIER
                            ? 'Fornecedor (conta)'
                            : 'Cliente (conta)'
                        )
                        .join(' · ')}
                    </p>
                    <p className="text-xs leading-relaxed text-content-muted">
                      A primeira escolha na nuvem continua registrada no campo legado{' '}
                      <span className="font-medium">role</span> (imutável). Quando existir, a lista{' '}
                      <span className="font-medium">accountRoles</span> é a fonte principal dos papéis
                      habilitados. Você pode acrescentar o outro papel de forma aditiva — não há troca
                      destrutiva nesta etapa.
                    </p>
                    {effectiveAccountRoles.length === 1 && (
                      <button
                        type="button"
                        onClick={handleAddSecondAccountRole}
                        disabled={addRoleSaving || roleSaving}
                        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface px-4 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                      >
                        {addRoleSaving
                          ? 'Salvando…'
                          : effectiveAccountRoles[0] === USER_ROLES.CLIENT
                            ? 'Habilitar também Fornecedor (conta)'
                            : 'Habilitar também Cliente (conta)'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-content">Papel ainda não definido</p>
                    {roleError && (
                      <div
                        className="rounded-design-md border border-edge bg-danger-soft px-4 py-3"
                        role="alert"
                      >
                        <p className="text-sm font-semibold leading-snug text-danger">{roleError}</p>
                      </div>
                    )}
                    <div
                      className="flex gap-0.5 rounded-design-md bg-surface-muted p-1 ring-1 ring-inset ring-edge/50"
                      role="tablist"
                      aria-label="Papel da conta na plataforma"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={roleDraft === USER_ROLES.SUPPLIER}
                        onClick={() => setRoleDraft(USER_ROLES.SUPPLIER)}
                        disabled={roleSaving}
                        className={`flex min-h-[44px] flex-1 items-center justify-center rounded-design-sm px-2 text-xs font-semibold transition-colors ${
                          roleDraft === USER_ROLES.SUPPLIER
                            ? 'bg-surface text-primary shadow-design-sm ring-1 ring-edge/40'
                            : 'text-content-muted hover:text-content-soft'
                        } disabled:opacity-60`}
                      >
                        Fornecedor (conta)
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={roleDraft === USER_ROLES.CLIENT}
                        onClick={() => setRoleDraft(USER_ROLES.CLIENT)}
                        disabled={roleSaving}
                        className={`flex min-h-[44px] flex-1 items-center justify-center rounded-design-sm px-2 text-xs font-semibold transition-colors ${
                          roleDraft === USER_ROLES.CLIENT
                            ? 'bg-surface text-primary shadow-design-sm ring-1 ring-edge/40'
                            : 'text-content-muted hover:text-content-soft'
                        } disabled:opacity-60`}
                      >
                        Cliente (conta)
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleConfirmRole}
                      disabled={roleSaving}
                      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md bg-primary px-4 text-sm font-semibold text-content-inverse shadow-design-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                    >
                      {roleSaving ? 'Confirmando…' : 'Confirmar papel'}
                    </button>
                  </div>
                )}
              </div>

              {canActAsClient && (
                <div className={sectionCardClass}>
                  <h3 className="mb-1 text-base font-semibold text-content">
                    Solicitações de empréstimo (plataforma)
                  </h3>
                  <p className="mb-4 text-xs leading-relaxed text-content-muted">
                    Envie um pedido ao fornecedor com vínculo aprovado. Isso não cria contrato no
                    app, não altera caixa e não sincroniza seu financeiro local.
                  </p>
                  <button
                    type="button"
                    onClick={() => setAccountSubView('loanRequests')}
                    disabled={!hasPlatformRole || linkGlobalBusy}
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-primary-soft px-4 text-sm font-semibold text-primary transition-colors active:bg-primary-soft/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                  >
                    Abrir solicitações
                  </button>
                  {!hasPlatformRole && (
                    <p className="mt-3 text-xs leading-relaxed text-content-muted">
                      Defina seu papel na plataforma acima para usar solicitações.
                    </p>
                  )}
                </div>
              )}

              {canActAsSupplier && (
                <div className={sectionCardClass}>
                  <h3 className="mb-1 text-base font-semibold text-content">
                    Pedidos recebidos (plataforma)
                  </h3>
                  <p className="mb-4 text-xs leading-relaxed text-content-muted">
                    Veja e responda solicitações de clientes vinculados. Não cria contrato no app e
                    não acessa o financeiro local de ninguém.
                  </p>
                  <button
                    type="button"
                    onClick={() => setAccountSubView('loanRequestsSupplier')}
                    disabled={!hasPlatformRole || linkGlobalBusy}
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-primary-soft px-4 text-sm font-semibold text-primary transition-colors active:bg-primary-soft/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                  >
                    Abrir pedidos recebidos
                  </button>
                  {!hasPlatformRole && (
                    <p className="mt-3 text-xs leading-relaxed text-content-muted">
                      Defina seu papel na plataforma acima para ver pedidos como fornecedor.
                    </p>
                  )}
                </div>
              )}

              <div className={sectionCardClass}>
                <h3 className="mb-1 text-base font-semibold text-content">Vínculos</h3>
                <p className="mb-5 text-xs leading-relaxed text-content-muted">
                  Vínculos ligam duas contas para relacionamento fornecedor ↔ cliente. Eles não
                  sincronizam empréstimos nem caixa.
                </p>

                {!hasPlatformRole && (
                  <p className="mb-4 text-xs leading-relaxed text-content-muted">
                    Defina seu papel acima para poder usar vínculos (pedidos dependem dos papéis nas
                    regras da nuvem).
                  </p>
                )}

                {dualAccountCapabilities && (
                  <div
                    className="mb-4 flex gap-0.5 rounded-design-md bg-surface-muted p-1 ring-1 ring-inset ring-edge/50"
                    role="tablist"
                    aria-label="Visão na conta (somente interface)"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={accountView === USER_ROLES.CLIENT}
                      onClick={() => setAccountView(USER_ROLES.CLIENT)}
                      disabled={linkGlobalBusy}
                      className={`flex min-h-10 flex-1 items-center justify-center rounded-design-sm px-2 text-xs font-semibold transition-colors ${
                        accountView === USER_ROLES.CLIENT
                          ? 'bg-surface text-primary shadow-design-sm ring-1 ring-edge/40'
                          : 'text-content-muted hover:text-content-soft'
                      } disabled:opacity-60`}
                    >
                      Ver como cliente (conta)
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={accountView === USER_ROLES.SUPPLIER}
                      onClick={() => setAccountView(USER_ROLES.SUPPLIER)}
                      disabled={linkGlobalBusy}
                      className={`flex min-h-10 flex-1 items-center justify-center rounded-design-sm px-2 text-xs font-semibold transition-colors ${
                        accountView === USER_ROLES.SUPPLIER
                          ? 'bg-surface text-primary shadow-design-sm ring-1 ring-edge/40'
                          : 'text-content-muted hover:text-content-soft'
                      } disabled:opacity-60`}
                    >
                      Ver como fornecedor (conta)
                    </button>
                  </div>
                )}

                {dualAccountCapabilities && (
                  <p className="mb-4 text-xs leading-relaxed text-content-muted">
                    Essa alternância só muda a visualização desta tela. O papel em cada vínculo é
                    definido pelo registro online do vínculo.
                  </p>
                )}

                {hasPlatformRole && canActAsClient && accountView === USER_ROLES.CLIENT && (
                  <div className="mb-4 space-y-3">
                    <p className="text-xs leading-relaxed text-content-muted">
                      Peça ao fornecedor o UID da conta dele (Conta → Seu identificador). Confirme
                      que ele já escolheu <span className="font-medium">Fornecedor (conta)</span>.
                      Depois cole o UID abaixo e envie o pedido.
                    </p>
                    <label
                      htmlFor="supplier-uid-link"
                      className="block text-sm font-medium text-content-soft"
                    >
                      UID do fornecedor (conta)
                    </label>
                    {linkRequestError && (
                      <div
                        className="rounded-design-md border border-edge bg-danger-soft px-4 py-3"
                        role="alert"
                      >
                        <p className="text-sm font-semibold leading-snug text-danger">
                          {linkRequestError}
                        </p>
                      </div>
                    )}
                    <input
                      id="supplier-uid-link"
                      type="text"
                      autoComplete="off"
                      value={supplierUidForLink}
                      onChange={(e) => {
                        setSupplierUidForLink(e.target.value);
                        if (linkRequestError) setLinkRequestError('');
                      }}
                      className="min-h-[44px] w-full rounded-design-md border border-edge bg-surface-muted px-4 py-2 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                      placeholder="Cole o UID da conta fornecedora"
                    />
                    <button
                      type="button"
                      onClick={handleCreateLinkRequest}
                      disabled={linkGlobalBusy}
                      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md bg-primary px-4 text-sm font-semibold text-content-inverse shadow-design-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                    >
                      {linkRequestSubmitting ? 'Enviando…' : 'Solicitar vínculo'}
                    </button>
                  </div>
                )}

                {hasPlatformRole && canActAsSupplier && accountView === USER_ROLES.SUPPLIER && (
                  <p className="mb-4 text-xs leading-relaxed text-content-muted">
                    Envie para quem for <span className="font-medium">cliente (conta)</span> o UID em{' '}
                    <span className="font-medium">Seu identificador (UID)</span> nesta tela. A outra
                    pessoa cola esse valor no pedido. Você só aprova, recusa ou revoga aqui embaixo
                    quando aparecer o vínculo.
                  </p>
                )}

                {linksError && (
                  <div
                    className="mb-4 rounded-design-md border border-edge bg-danger-soft px-4 py-3"
                    role="alert"
                  >
                    <p className="text-sm font-semibold leading-snug text-danger">{linksError}</p>
                  </div>
                )}

                {linksLoading ? (
                  <p className="text-center text-sm text-content-muted">Carregando vínculos…</p>
                ) : links.length === 0 ? (
                  <p className="text-sm text-content-muted">Nenhum vínculo ainda.</p>
                ) : (
                  <ul className="space-y-3">
                    {links.map((link) => {
                      const otherUid =
                        link.supplierId === user.uid ? link.clientId : link.supplierId;
                      const statusLabel = getLinkStatusLabelPt(link.status);
                      const busy = linkGlobalBusy;
                      return (
                        <li
                          key={link.id}
                          className="rounded-design-md border border-edge bg-surface-muted px-4 py-3"
                        >
                          <p className="text-xs font-medium uppercase tracking-wide text-content-muted">
                            Outra parte (UID)
                          </p>
                          <p className="mt-0.5 break-all text-sm font-medium text-content">
                            {otherUid}
                          </p>
                          <p className="mt-2 text-xs text-content-muted">
                            Status:{' '}
                            <span className="font-medium text-content-soft">{statusLabel}</span>
                          </p>

                          {hasPlatformRole &&
                            link.clientId === user.uid &&
                            canActAsClient &&
                            link.status === LINK_STATUSES.PENDING && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  handleLinkTransition(
                                    link,
                                    LINK_STATUSES.CANCELLED_BY_CLIENT,
                                    USER_ROLES.CLIENT
                                  )
                                }
                                className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                              >
                                Cancelar pedido
                              </button>
                            )}

                          {hasPlatformRole &&
                            link.supplierId === user.uid &&
                            canActAsSupplier &&
                            link.status === LINK_STATUSES.PENDING && (
                              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    handleLinkTransition(
                                      link,
                                      LINK_STATUSES.APPROVED,
                                      USER_ROLES.SUPPLIER
                                    )
                                  }
                                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-design-md bg-primary px-3 text-sm font-semibold text-content-inverse shadow-design-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                                >
                                  Aprovar
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    handleLinkTransition(
                                      link,
                                      LINK_STATUSES.REJECTED,
                                      USER_ROLES.SUPPLIER
                                    )
                                  }
                                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                                >
                                  Recusar
                                </button>
                              </div>
                            )}

                          {hasPlatformRole &&
                            link.supplierId === user.uid &&
                            canActAsSupplier &&
                            link.status === LINK_STATUSES.APPROVED && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  handleLinkTransition(
                                    link,
                                    LINK_STATUSES.REVOKED_BY_SUPPLIER,
                                    USER_ROLES.SUPPLIER
                                  )
                                }
                                className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                              >
                                Revogar vínculo
                              </button>
                            )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}

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
