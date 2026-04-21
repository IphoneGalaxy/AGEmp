import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

import { auth, firebaseEnabled } from '../firebase';
import { ensureUserProfileExists } from '../firebase/users';
import { mapFirebaseAuthError } from './authErrors';

/**
 * @typedef {{ ok: true } | { ok: false; message: string }} AuthActionResult
 */

const AuthContext = createContext(null);
const AUTH_UNAVAILABLE_MESSAGE = 'A conta não está disponível neste ambiente.';

/**
 * Provider único: um listener `onAuthStateChanged` para toda a árvore.
 * Não altera fluxo local-first; não exige login.
 *
 * Verificação de e-mail (sendEmailVerification / gate por `user.emailVerified`): fora
 * do escopo nesta rodada; fica no backlog da próxima fase de identidade.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  /** `false` até a primeira resposta do Firebase (evita assumir “deslogado” cedo demais). */
  const [authReady, setAuthReady] = useState(false);
  const ensuredProfileUidsRef = useRef(new Set());
  const profileRetryTimeoutRef = useRef(null);

  const clearProfileRetry = useCallback(() => {
    if (profileRetryTimeoutRef.current != null) {
      window.clearTimeout(profileRetryTimeoutRef.current);
      profileRetryTimeoutRef.current = null;
    }
  }, []);

  const ensureRemoteProfile = useCallback(async (nextUser) => {
    if (!firebaseEnabled || !nextUser?.uid) {
      return;
    }

    const attemptEnsure = async () => {
      if (ensuredProfileUidsRef.current.has(nextUser.uid)) {
        return;
      }

      ensuredProfileUidsRef.current.add(nextUser.uid);

      try {
        await ensureUserProfileExists(nextUser);
        clearProfileRetry();
      } catch (error) {
        ensuredProfileUidsRef.current.delete(nextUser.uid);
        console.warn('[Auth] Falha ao garantir perfil remoto do usuário:', error);

        if (auth?.currentUser?.uid !== nextUser.uid || profileRetryTimeoutRef.current != null) {
          return;
        }

        profileRetryTimeoutRef.current = window.setTimeout(() => {
          profileRetryTimeoutRef.current = null;
          void attemptEnsure();
        }, 15000);
      }
    };

    if (ensuredProfileUidsRef.current.has(nextUser.uid)) {
      return;
    }

    void attemptEnsure();
  }, [clearProfileRetry]);

  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      setAuthReady(true);
      return clearProfileRetry;
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (!nextUser?.uid) {
        ensuredProfileUidsRef.current.clear();
        clearProfileRetry();
        return;
      }

      // A criação do perfil é assíncrona e não deve bloquear o app local-first.
      void ensureRemoteProfile(nextUser);
    });

    return () => {
      clearProfileRetry();
      unsubscribe();
    };
  }, [clearProfileRetry, ensureRemoteProfile]);

  const login = useCallback(async (email, password) => {
    if (!auth) {
      return { ok: false, message: AUTH_UNAVAILABLE_MESSAGE };
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: mapFirebaseAuthError(e) };
    }
  }, []);

  const signup = useCallback(async (email, password) => {
    if (!auth) {
      return { ok: false, message: AUTH_UNAVAILABLE_MESSAGE };
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: mapFirebaseAuthError(e) };
    }
  }, []);

  const logout = useCallback(async () => {
    if (!auth) {
      return { ok: false, message: AUTH_UNAVAILABLE_MESSAGE };
    }

    try {
      await signOut(auth);
      clearProfileRetry();
      ensuredProfileUidsRef.current.clear();
      return { ok: true };
    } catch (e) {
      return { ok: false, message: mapFirebaseAuthError(e) };
    }
  }, [clearProfileRetry]);

  const requestPasswordReset = useCallback(async (email) => {
    if (!auth) {
      return { ok: false, message: AUTH_UNAVAILABLE_MESSAGE };
    }

    const trimmed = String(email ?? '').trim();
    if (!trimmed) {
      return { ok: false, message: 'Informe o e-mail para enviar a recuperação.' };
    }

    try {
      await sendPasswordResetEmail(auth, trimmed);
      return { ok: true };
    } catch (e) {
      const code =
        e && typeof e === 'object' && 'code' in e && typeof e.code === 'string' ? e.code : null;
      if (code === 'auth/user-not-found') {
        return {
          ok: false,
          message:
            'Não encontramos uma conta com este e-mail. Confira o endereço ou crie uma conta.',
        };
      }
      return { ok: false, message: mapFirebaseAuthError(e) };
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      authReady,
      authAvailable: firebaseEnabled,
      login,
      signup,
      logout,
      requestPasswordReset,
    }),
    [user, authReady, login, signup, logout, requestPasswordReset]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

/**
 * @returns {{
 *   user: import('firebase/auth').User | null;
 *   authReady: boolean;
 *   authAvailable: boolean;
 *   login: (email: string, password: string) => Promise<AuthActionResult>;
 *   signup: (email: string, password: string) => Promise<AuthActionResult>;
 *   logout: () => Promise<AuthActionResult>;
 *   requestPasswordReset: (email: string) => Promise<AuthActionResult>;
 * }}
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx == null) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider.');
  }
  return ctx;
}
