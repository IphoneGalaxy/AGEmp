import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { normalizeDisplayNameForSnapshot } from '../utils/displayNameSnapshots';
import { mapLinkFirestoreError, normalizeFirestoreErrorCode } from './firestoreErrors';
import { db } from './index';
import { USER_ROLES, profileHasEffectiveAccountRole } from './roles';
import { getUserProfile } from './users';

export const LINKS_COLLECTION = 'links';

export const LINK_STATUSES = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED_BY_CLIENT: 'cancelled_by_client',
  REVOKED_BY_SUPPLIER: 'revoked_by_supplier',
});

export const LINK_STATUS_VALUES = Object.freeze(Object.values(LINK_STATUSES));

/** Rótulos curtos para UI (conta na plataforma, não confundir com clientes financeiros locais). */
const LINK_STATUS_LABELS_PT = Object.freeze({
  [LINK_STATUSES.PENDING]: 'Pendente',
  [LINK_STATUSES.APPROVED]: 'Aprovado',
  [LINK_STATUSES.REJECTED]: 'Recusado',
  [LINK_STATUSES.CANCELLED_BY_CLIENT]: 'Cancelado pelo cliente (conta)',
  [LINK_STATUSES.REVOKED_BY_SUPPLIER]: 'Revogado pelo fornecedor (conta)',
});

/**
 * @param {unknown} status
 */
export function getLinkStatusLabelPt(status) {
  if (typeof status !== 'string') {
    return '';
  }
  return LINK_STATUS_LABELS_PT[status] ?? status;
}

export const LINK_REQUESTED_BY = Object.freeze({
  CLIENT: USER_ROLES.CLIENT,
});

const LINK_REQUESTED_BY_VALUES = Object.freeze(Object.values(LINK_REQUESTED_BY));
const REMOTE_LINKS_UNAVAILABLE_MESSAGE = 'Vínculos remotos indisponíveis neste ambiente.';

/** Vínculo encerrado: nova solicitação reaproveita o mesmo doc `supplierId__clientId`. */
export const LINK_RESTARTABLE_AFTER_END_STATUSES = Object.freeze([
  LINK_STATUSES.REJECTED,
  LINK_STATUSES.CANCELLED_BY_CLIENT,
  LINK_STATUSES.REVOKED_BY_SUPPLIER,
]);

const LINK_STATUS_TRANSITIONS = Object.freeze({
  [USER_ROLES.CLIENT]: Object.freeze({
    [LINK_STATUSES.PENDING]: Object.freeze([LINK_STATUSES.CANCELLED_BY_CLIENT]),
    [LINK_STATUSES.REJECTED]: Object.freeze([LINK_STATUSES.PENDING]),
    [LINK_STATUSES.CANCELLED_BY_CLIENT]: Object.freeze([LINK_STATUSES.PENDING]),
    [LINK_STATUSES.REVOKED_BY_SUPPLIER]: Object.freeze([LINK_STATUSES.PENDING]),
  }),
  [USER_ROLES.SUPPLIER]: Object.freeze({
    [LINK_STATUSES.PENDING]: Object.freeze([LINK_STATUSES.APPROVED, LINK_STATUSES.REJECTED]),
    [LINK_STATUSES.APPROVED]: Object.freeze([LINK_STATUSES.REVOKED_BY_SUPPLIER]),
  }),
});

/**
 * @param {unknown} status
 * @returns {status is string}
 */
export function isValidLinkStatus(status) {
  return typeof status === 'string' && LINK_STATUS_VALUES.includes(status);
}

/**
 * @param {unknown} requestedBy
 * @returns {requestedBy is 'client'}
 */
export function isValidLinkRequestedBy(requestedBy) {
  return typeof requestedBy === 'string' && LINK_REQUESTED_BY_VALUES.includes(requestedBy);
}

/**
 * @param {unknown} actorRole
 * @returns {actorRole is 'supplier' | 'client'}
 */
export function isValidLinkActorRole(actorRole) {
  return actorRole === USER_ROLES.SUPPLIER || actorRole === USER_ROLES.CLIENT;
}

/**
 * @param {'supplier' | 'client'} actorRole
 * @param {string} currentStatus
 * @param {string} nextStatus
 */
export function canActorTransitionLinkStatus(actorRole, currentStatus, nextStatus) {
  if (!isValidLinkActorRole(actorRole)) {
    return false;
  }

  if (!isValidLinkStatus(currentStatus) || !isValidLinkStatus(nextStatus)) {
    return false;
  }

  return LINK_STATUS_TRANSITIONS[actorRole]?.[currentStatus]?.includes(nextStatus) ?? false;
}

/**
 * Cliente pode pedir novo vínculo (doc único por par): só quando o atual não está
 * `pending` nem `approved`.
 *
 * @param {unknown} status
 */
export function canClientRestartLinkAfterEndedStatus(status) {
  return typeof status === 'string' && LINK_RESTARTABLE_AFTER_END_STATUSES.includes(status);
}

/**
 * Um vínculo é único por par fornecedor-cliente nesta fatia inicial.
 *
 * @param {string} supplierId
 * @param {string} clientId
 */
export function getLinkId(supplierId, clientId) {
  return `${supplierId}__${clientId}`;
}

/**
 * @param {string} supplierId
 * @param {string} clientId
 */
export function getLinkRef(supplierId, clientId) {
  if (!db) {
    throw new Error('Firestore não está configurado neste ambiente.');
  }

  return doc(db, LINKS_COLLECTION, getLinkId(supplierId, clientId));
}

/**
 * @param {{
 *   supplierId: string;
 *   clientId: string;
 *   requestedBy?: 'client';
 * }} params
 */
export function buildLinkData({
  supplierId,
  clientId,
  requestedBy = LINK_REQUESTED_BY.CLIENT,
}) {
  const committedAt = serverTimestamp();
  return {
    supplierId,
    clientId,
    status: LINK_STATUSES.PENDING,
    requestedBy,
    createdAt: committedAt,
    updatedAt: committedAt,
  };
}

/**
 * Representação estável do payload para console em DEV (sem depender de internals do SDK).
 *
 * @param {Record<string, unknown>} data
 */
export function formatLinkWritePayloadForDevLog(data) {
  const createdAtAndUpdatedAtSameReference =
    data.createdAt != null && data.createdAt === data.updatedAt;
  /** @type {Record<string, unknown>} */
  const out = {
    supplierId: data.supplierId,
    clientId: data.clientId,
    status: data.status,
    requestedBy: data.requestedBy,
    createdAt: '[FieldValue.serverTimestamp]',
    updatedAt: '[FieldValue.serverTimestamp]',
    createdAtAndUpdatedAtSameReference,
  };
  if (Object.prototype.hasOwnProperty.call(data, 'clientDisplayNameSnapshot')) {
    out.clientDisplayNameSnapshot = data.clientDisplayNameSnapshot;
  }
  if (Object.prototype.hasOwnProperty.call(data, 'supplierDisplayNameSnapshot')) {
    out.supplierDisplayNameSnapshot = data.supplierDisplayNameSnapshot;
  }
  return out;
}

function validateLinkParticipants(supplierId, clientId) {
  if (!supplierId || !clientId) {
    return 'Fornecedor e cliente são obrigatórios.';
  }

  if (supplierId === clientId) {
    return 'Fornecedor e cliente devem ser contas diferentes.';
  }

  return null;
}

/**
 * Lê `users/{uid}` (rule `get` autenticado) e garante papel Cliente na conta cliente e Fornecedor na conta fornecedor.
 * Reuso: criação de vínculo na transação e checagens pré-write de pedidos em `loanRequests`.
 *
 * @param {string} clientId
 * @param {string} supplierId
 * @returns {Promise<
 *   | { ok: true; clientProfile: Record<string, unknown>; supplierProfile: Record<string, unknown> }
 *   | { ok: false; message: string }
 * >}
 */
export async function preflightUsersForLinkCreate(clientId, supplierId) {
  let clientProfile;
  let supplierProfile;

  try {
    [clientProfile, supplierProfile] = await Promise.all([
      getUserProfile(clientId),
      getUserProfile(supplierId),
    ]);
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[links] createLinkRequest: falha ao ler perfis (preflight)', e);
    }
    if (normalizeFirestoreErrorCode(e) === 'permission-denied') {
      return {
        ok: false,
        message:
          'Não foi possível ler os perfis na nuvem (permissão negada). Confirme se você está conectado, se o projeto Firebase do app é o mesmo do console e se as regras publicadas permitem leitura de `users` para contas autenticadas (etapa de vínculo).',
      };
    }
    return { ok: false, message: mapLinkFirestoreError(e) };
  }

  if (!clientProfile) {
    return {
      ok: false,
      message:
        'Não encontramos o perfil remoto da sua conta. Abra Conta, aguarde carregar ou use "Tentar novamente" no bloco de perfil.',
    };
  }

  if (!profileHasEffectiveAccountRole(clientProfile, USER_ROLES.CLIENT)) {
    const r =
      clientProfile.role != null ? String(clientProfile.role) : 'não definido';
    const ar = clientProfile.accountRoles;
    const arHint = Array.isArray(ar) ? JSON.stringify(ar) : 'ausente';
    return {
      ok: false,
      message: `Para solicitar vínculo você precisa ter o papel Cliente (conta) habilitado na nuvem. Papéis efetivos do seu perfil não incluem cliente (legado role: "${r}", accountRoles: ${arHint}). Confirme em Conta.`,
    };
  }

  if (!supplierProfile) {
    return {
      ok: false,
      message:
        'Não há perfil remoto com este UID. Confira cada caractere (0 e O, 1 e l costumam trocar) e use o valor exato em Conta → Seu identificador (UID) na conta do fornecedor.',
    };
  }

  if (!profileHasEffectiveAccountRole(supplierProfile, USER_ROLES.SUPPLIER)) {
    const r =
      supplierProfile.role != null ? String(supplierProfile.role) : 'não definido';
    const ar = supplierProfile.accountRoles;
    const arHint = Array.isArray(ar) ? JSON.stringify(ar) : 'ausente';
    return {
      ok: false,
      message: `Esta conta existe, mas não tem o papel Fornecedor (conta) habilitado na nuvem (legado role: "${r}", accountRoles: ${arHint}). A outra pessoa precisa habilitar Fornecedor (conta) em Conta.`,
    };
  }

  return { ok: true, clientProfile, supplierProfile };
}

/**
 * @param {string} supplierId
 * @param {string} clientId
 */
export async function getLink(supplierId, clientId) {
  if (!db || !supplierId || !clientId) {
    return null;
  }

  const snapshot = await getDoc(getLinkRef(supplierId, clientId));
  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: getLinkId(supplierId, clientId),
    ...snapshot.data(),
  };
}

/**
 * Lista vínculos em que o usuário participa (como fornecedor ou como cliente da plataforma).
 * Duas consultas são mescladas e deduplicadas pelo id do documento.
 *
 * @param {string} uid
 * @returns {Promise<Array<{ id: string } & Record<string, unknown>>}
 */
export async function listUserLinks(uid) {
  if (!db || !uid) {
    return [];
  }

  const col = collection(db, LINKS_COLLECTION);
  const qSupplier = query(col, where('supplierId', '==', uid));
  const qClient = query(col, where('clientId', '==', uid));
  const [snapSupplier, snapClient] = await Promise.all([getDocs(qSupplier), getDocs(qClient)]);

  const byId = new Map();
  for (const snap of [snapSupplier, snapClient]) {
    snap.forEach((docSnap) => {
      if (!byId.has(docSnap.id)) {
        byId.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
      }
    });
  }

  return Array.from(byId.values());
}

/**
 * @param {{
 *   supplierId: string;
 *   clientId: string;
 *   requestedBy?: 'client';
 * }} params
 * @returns {Promise<{ ok: true; id: string } | { ok: false; message: string }>}
 */
export async function createLinkRequest({
  supplierId,
  clientId,
  requestedBy = LINK_REQUESTED_BY.CLIENT,
}) {
  if (!db) {
    return { ok: false, message: REMOTE_LINKS_UNAVAILABLE_MESSAGE };
  }

  const participantsError = validateLinkParticipants(supplierId, clientId);
  if (participantsError) {
    return { ok: false, message: participantsError };
  }

  if (!isValidLinkRequestedBy(requestedBy)) {
    return {
      ok: false,
      message: `Solicitação inválida. Use ${LINK_REQUESTED_BY_VALUES.join(' ou ')}.`,
    };
  }

  const preflight = await preflightUsersForLinkCreate(clientId, supplierId);
  if (!preflight.ok) {
    if (import.meta.env.DEV) {
      console.warn('[links] createLinkRequest: preflight negou', preflight.message);
    }
    return preflight;
  }

  if (import.meta.env.DEV) {
    const mask = (id) =>
      id && id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)} (len ${id.length})` : id;
    console.info('[links] createLinkRequest: preflight OK', {
      clientId: mask(clientId),
      supplierId: mask(supplierId),
    });
  }

  try {
    return await runTransaction(db, async (transaction) => {
      const linkRef = getLinkRef(supplierId, clientId);
      const snapshot = await transaction.get(linkRef);

      if (!snapshot.exists()) {
        const clientSnap = normalizeDisplayNameForSnapshot(
          preflight.clientProfile?.displayName,
        );
        const linkPayload = buildLinkData({ supplierId, clientId, requestedBy });
        if (clientSnap !== null) {
          linkPayload.clientDisplayNameSnapshot = clientSnap;
        }
        if (import.meta.env.DEV) {
          console.info(
            '[links] createLinkRequest: payload antes do transaction.set',
            formatLinkWritePayloadForDevLog(linkPayload)
          );
        }
        transaction.set(linkRef, linkPayload);
        return { ok: true, id: linkRef.id };
      }

      const prev = snapshot.data();
      if (prev.supplierId !== supplierId || prev.clientId !== clientId) {
        return {
          ok: false,
          message:
            'Registro de vínculo inconsistente com o par fornecedor/cliente. Recarregue a lista.',
        };
      }

      const st =
        typeof prev.status === 'string' && LINK_STATUS_VALUES.includes(prev.status)
          ? prev.status
          : '';

      if (st === LINK_STATUSES.PENDING || st === LINK_STATUSES.APPROVED) {
        return {
          ok: false,
          message: 'Já existe um vínculo ou solicitação entre estas contas.',
        };
      }

      if (!canClientRestartLinkAfterEndedStatus(st)) {
        return {
          ok: false,
          message: `Não é possível solicitar novo vínculo neste estado (${st}). Recarregue a lista.`,
        };
      }

      if (prev.requestedBy !== LINK_REQUESTED_BY.CLIENT) {
        return {
          ok: false,
          message: 'Este registro de vínculo não segue o modelo esperado (solicitação inicial).',
        };
      }

      // Reabertura: rules só permitem diff em `status` e `updatedAt` — não é possível
      // atualizar clientDisplayNameSnapshot aqui sem nova rodada nas rules (ADR Subfase 2).
      transaction.update(linkRef, {
        status: LINK_STATUSES.PENDING,
        updatedAt: serverTimestamp(),
      });
      return { ok: true, id: linkRef.id };
    });
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[links] createLinkRequest: falha na transação', {
        code: normalizeFirestoreErrorCode(e),
        message: e instanceof Error ? e.message : String(e),
      });
    }
    return { ok: false, message: mapLinkFirestoreError(e) };
  }
}

/**
 * @param {{
 *   supplierId: string;
 *   clientId: string;
 *   actorRole: 'supplier' | 'client';
 *   currentStatus: string;
 *   nextStatus: string;
 * }} params
 * @returns {Promise<{ ok: true } | { ok: false; message: string }>}
 */
export async function transitionLinkStatus({
  supplierId,
  clientId,
  actorRole,
  currentStatus,
  nextStatus,
}) {
  if (!db) {
    return { ok: false, message: REMOTE_LINKS_UNAVAILABLE_MESSAGE };
  }

  const participantsError = validateLinkParticipants(supplierId, clientId);
  if (participantsError) {
    return { ok: false, message: participantsError };
  }

  if (!canActorTransitionLinkStatus(actorRole, currentStatus, nextStatus)) {
    return {
      ok: false,
      message: 'Transição de vínculo inválida para o papel informado.',
    };
  }

  try {
    /** @type {Record<string, unknown>} */
    const patch = {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    };

    if (
      actorRole === USER_ROLES.SUPPLIER &&
      currentStatus === LINK_STATUSES.PENDING &&
      nextStatus === LINK_STATUSES.APPROVED
    ) {
      try {
        const supplierProfile = await getUserProfile(supplierId);
        const supplierSnap = normalizeDisplayNameForSnapshot(
          supplierProfile?.displayName,
        );
        if (supplierSnap !== null) {
          patch.supplierDisplayNameSnapshot = supplierSnap;
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn(
            '[links] transitionLinkStatus: falha ao ler displayName do fornecedor; segue sem snapshot',
            normalizeFirestoreErrorCode(e),
          );
        }
      }
    }

    await updateDoc(getLinkRef(supplierId, clientId), patch);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: mapLinkFirestoreError(e) };
  }
}
