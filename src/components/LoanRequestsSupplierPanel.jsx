import React, { useCallback, useEffect, useState } from 'react';

import { formatMoney } from '../utils/format';
import { mapFirestoreError } from '../firebase/firestoreErrors';
import {
  listLoanRequestsForSupplier,
  markLoanRequestReadBySupplier,
  supplierApproveLoanRequest,
  supplierMarkLoanRequestUnderReview,
  supplierProposeLoanRequestCounteroffer,
  supplierRejectLoanRequest,
} from '../firebase/loanRequestsFirestore';
import {
  LOAN_REQUEST_MAX_AMOUNT_CENTS,
  LOAN_REQUEST_MAX_NOTE_CHARS,
  LOAN_REQUEST_MIN_AMOUNT_CENTS,
  LOAN_REQUEST_STATUSES,
  getLoanRequestStatusLabelPt,
  isLoanRequestSupplierNegotiationStatesV1,
  isLoanRequestTerminalStatusV1,
} from '../firebase/loanRequests';
import { parseBrlMoneyInputToCents } from '../utils/brlMoneyInput';
import ConvertLoanRequestToContractReview from './ConvertLoanRequestToContractReview';
import { hasConvertedLoanRequestDuplicate } from '../utils/convertLoanRequestToLocalContract';
import {
  LOAN_REQUEST_SUPPLIER_EXPANDED_LINK_CAPTION,
  LOAN_REQUEST_SUPPLIER_ROW_CLIENT_CAPTION,
} from '../utils/platformFriendlyLabels';

const sectionCardClass =
  'rounded-design-lg border border-edge bg-surface p-5 shadow-design-sm sm:p-6';

/**
 * Sem readBySupplierAt, vários pendings legados recebiam "Novo" igual ao primeiro.
 * Mantém "Novo" só em pendências com criação recente (fluxo atual do app).
 */
const SUPPLIER_UNREAD_PENDING_MAX_AGE_SEC = 14 * 24 * 60 * 60;

/**
 * @param {import('firebase/firestore').Timestamp | undefined} ts
 */
function formatRequestTimestamp(ts) {
  if (!ts || typeof ts.toDate !== 'function') {
    return '—';
  }
  try {
    const d = ts.toDate();
    const date = d.toLocaleDateString('pt-BR');
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${date} às ${time}`;
  } catch {
    return '—';
  }
}

function hasFirestoreTimestampSeconds(ts) {
  return !!(ts && typeof ts === 'object' && typeof ts.seconds === 'number');
}

/** @param {unknown} ts */
function firestoreTimestampSecondsOrNull(ts) {
  if (ts == null) return null;
  if (typeof ts !== 'object') return null;
  if (typeof ts.seconds === 'number') return ts.seconds;
  if (typeof ts._seconds === 'number') return ts._seconds;
  if (typeof ts.toMillis === 'function') {
    try {
      const ms = ts.toMillis();
      if (Number.isFinite(ms)) return Math.floor(ms / 1000);
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** @param {(number | null)[]} candidates */
function maxSecondsOrNull(candidates) {
  const nums = candidates.filter((x) => typeof x === 'number' && Number.isFinite(x));
  return nums.length ? Math.max(...nums) : null;
}

/** @param {Record<string, unknown>} r */
function isPendingUnreadWindowSupplier(r) {
  const sec = firestoreTimestampSecondsOrNull(r.createdAt);
  if (sec == null) return false;
  const age = Math.floor(Date.now() / 1000) - sec;
  return age >= 0 && age <= SUPPLIER_UNREAD_PENDING_MAX_AGE_SEC;
}

/**
 * Último instante de atividade relevante do cliente (badge "Novo" do fornecedor).
 * @param {Record<string, unknown>} r
 * @returns {number | null}
 */
function getClientEventSecondsForSupplierBadge(r) {
  const status = typeof r.status === 'string' ? r.status : '';
  const createdAt = firestoreTimestampSecondsOrNull(r.createdAt);
  const cancelledAt = firestoreTimestampSecondsOrNull(r.cancelledAt);
  const respondedAt = firestoreTimestampSecondsOrNull(r.respondedAt);
  const updatedAt = firestoreTimestampSecondsOrNull(r.updatedAt);

  const candidates = [createdAt];

  if (status === LOAN_REQUEST_STATUSES.CANCELLED_BY_CLIENT) {
    candidates.push(cancelledAt, updatedAt);
    return maxSecondsOrNull(candidates);
  }
  if (status === LOAN_REQUEST_STATUSES.COUNTEROFFER_DECLINED) {
    candidates.push(respondedAt, updatedAt);
    return maxSecondsOrNull(candidates);
  }
  if (status === LOAN_REQUEST_STATUSES.APPROVED) {
    const viaCounteroffer =
      typeof r.approvedAmount === 'number' &&
      typeof r.requestedAmount === 'number' &&
      r.approvedAmount !== r.requestedAmount;
    if (viaCounteroffer) {
      candidates.push(respondedAt, updatedAt);
      return maxSecondsOrNull(candidates);
    }
  }
  return maxSecondsOrNull(candidates);
}

/**
 * @param {Record<string, unknown>} r
 * @returns {boolean}
 */
function shouldShowUnreadBadgeSupplierPanel(r) {
  const clientEvt = getClientEventSecondsForSupplierBadge(r);
  if (clientEvt == null) return false;
  const readSec = firestoreTimestampSecondsOrNull(r.readBySupplierAt);
  const status = typeof r.status === 'string' ? r.status : '';
  const isTerminal = isLoanRequestTerminalStatusV1(status);

  if (readSec != null) {
    return clientEvt > readSec;
  }

  // Sem readBySupplierAt em pedidos encerrados: legado pré-v1.1 RB ou nunca gravaram leitura —
  // não repetir eternamente "Novo" só porque aceite/recusa pós-cadastro aumenta clientEvt.
  if (isTerminal) {
    return false;
  }

  if (status === LOAN_REQUEST_STATUSES.PENDING) {
    return isPendingUnreadWindowSupplier(r);
  }

  /* Sem readBy: em_análise / contraposta exige atuação prévia do fornecedor — evita "Novo" eterno em legado. */
  return false;
}

/**
 * Alerta B2 (Bloco 1): comparar pedido (centavos) com Total disponível local (reais).
 * Só em negociação aberta **pending** ou **under_review** — não em terminal nem em `counteroffer`.
 *
 * @param {string} status
 * @param {unknown} requestedAmountCents
 * @param {unknown} availableMoneyReais
 * @returns {boolean}
 */
function shouldShowLocalAvailableShortfall(status, requestedAmountCents, availableMoneyReais) {
  if (typeof status !== 'string') return false;
  if (isLoanRequestTerminalStatusV1(status)) return false;
  if (status !== LOAN_REQUEST_STATUSES.PENDING && status !== LOAN_REQUEST_STATUSES.UNDER_REVIEW) {
    return false;
  }
  if (typeof requestedAmountCents !== 'number' || !Number.isFinite(requestedAmountCents)) return false;
  if (typeof availableMoneyReais !== 'number' || !Number.isFinite(availableMoneyReais)) return false;
  return requestedAmountCents / 100 > availableMoneyReais;
}

/**
 * @param {Object} props
 * @param {import('firebase/auth').User | null} props.user
 * @param {(msg: string) => void} [props.showToast]
 * @param {number} [props.availableMoney] Total disponível local em reais (calculateGlobalStats)
 * @param {number} [props.defaultInterestRate] Taxa padrão (%) para sugestão na revisão Bloco 2 — igual à configuração de novo contrato manual.
 * @param {unknown[]} [props.clients] Clientes financeiros locais (escopo atual) para conversão Bloco2-C.
 * @param {(updater: (prev: unknown[]) => unknown[]) => void} [props.onUpdateClients] Atualização imutável de clientes (mesmo contrato que ClientView).
 */
export default function LoanRequestsSupplierPanel({
  user,
  showToast,
  availableMoney,
  defaultInterestRate = 10,
  clients = [],
  onUpdateClients,
}) {
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [notesDraft, setNotesDraft] = useState({});
  const [counterofferInput, setCounterofferInput] = useState({});
  const [actingId, setActingId] = useState(null);
  /** Bloco 2 — revisão de conversão (sem persistência nesta rodada). */
  const [convertReviewRequest, setConvertReviewRequest] = useState(null);

  const loadRequests = useCallback(async () => {
    if (!user?.uid) {
      setRequests([]);
      return;
    }
    setRequestsLoading(true);
    setRequestsError('');
    try {
      const list = await listLoanRequestsForSupplier(user.uid);
      setRequests(list);
    } catch (e) {
      setRequestsError(mapFirestoreError(e));
    } finally {
      setRequestsLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!expandedId || !user?.uid) return;
    const row = requests.find((x) => x.id === expandedId);
    if (!row) return;
    const srSec = firestoreTimestampSecondsOrNull(row.readBySupplierAt);
    const clientEvt = getClientEventSecondsForSupplierBadge(row);
    const status = typeof row.status === 'string' ? row.status : '';
    const isTerminal = isLoanRequestTerminalStatusV1(status);
    const isOpen =
      status === LOAN_REQUEST_STATUSES.PENDING ||
      status === LOAN_REQUEST_STATUSES.UNDER_REVIEW ||
      status === LOAN_REQUEST_STATUSES.COUNTEROFFER;

    let needMark = false;
    if (srSec != null) {
      needMark = clientEvt != null && clientEvt > srSec;
    } else if (isOpen) {
      needMark = true;
    }
    /* terminal + sem readBy*: não gravar marcação só por expandir histórico */
    if (isTerminal && srSec == null) {
      needMark = false;
    }
    if (!needMark) return;
    void markLoanRequestReadBySupplier({
      requestId: expandedId,
      supplierUid: user.uid,
    }).then((r) => {
      if (r.ok) void loadRequests();
    }).catch((err) => {
      console.warn('[LoanRequests] markLoanRequestReadBySupplier failed', { requestId: expandedId, error: err });
    });
  }, [expandedId, user?.uid, requests, loadRequests]);

  const setNoteFor = (id, value) => {
    setNotesDraft((prev) => ({ ...prev, [id]: value }));
  };

  const supplierNoteFor = (id) => notesDraft[id] ?? '';

  const counterofferDraftFor = (id) => counterofferInput[id] ?? '';

  const setCounterofferFor = (id, value) => {
    setCounterofferInput((prev) => ({ ...prev, [id]: value }));
  };

  const runSupplierAction = async (requestId, action) => {
    if (!user?.uid) return;
    setActingId(requestId);
    try {
      const note = supplierNoteFor(requestId);
      const params = { requestId, supplierUid: user.uid, supplierNote: note };
      let result;
      if (action === 'under_review') {
        result = await supplierMarkLoanRequestUnderReview(params);
      } else if (action === 'approved') {
        result = await supplierApproveLoanRequest(params);
      } else if (action === 'rejected') {
        result = await supplierRejectLoanRequest(params);
      } else {
        return;
      }

      if (result.ok) {
        const msg =
          action === 'under_review'
            ? 'Pedido marcado como em análise.'
            : action === 'approved'
              ? 'Pedido aprovado na plataforma (não cria contrato no app).'
              : 'Pedido recusado.';
        showToast?.(msg);
        setNoteFor(requestId, '');
        setCounterofferFor(requestId, '');
        setExpandedId(null);
        await loadRequests();
      } else {
        showToast?.(result.message);
      }
    } finally {
      setActingId(null);
    }
  };

  const runSupplierCounteroffer = async (requestId) => {
    if (!user?.uid) return;
    setActingId(requestId);
    try {
      const raw = counterofferDraftFor(requestId);
      const parsed = parseBrlMoneyInputToCents(raw, {
        minCents: LOAN_REQUEST_MIN_AMOUNT_CENTS,
        maxCents: LOAN_REQUEST_MAX_AMOUNT_CENTS,
      });
      if (!parsed.ok) {
        showToast?.(parsed.message);
        return;
      }
      const result = await supplierProposeLoanRequestCounteroffer({
        requestId,
        supplierUid: user.uid,
        counterofferAmountCents: parsed.cents,
        supplierNote: supplierNoteFor(requestId),
      });
      if (result.ok) {
        showToast?.('Contraproposta enviada. Aguarde a decisão do cliente na plataforma.');
        setNoteFor(requestId, '');
        setCounterofferFor(requestId, '');
        setExpandedId(null);
        await loadRequests();
      } else {
        showToast?.(result.message);
      }
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className={sectionCardClass}>
        <h3 className="mb-2 text-base font-semibold text-content">Sobre estes pedidos</h3>
        <p className="text-xs leading-relaxed text-content-muted">
          Você está respondendo a uma <span className="font-medium text-content-soft">solicitação</span>{' '}
          na plataforma. Isso <span className="font-medium text-content-soft">não cria contrato</span>{' '}
          no app do cliente nem no seu, <span className="font-medium text-content-soft">não mexe em caixa</span>{' '}
          e <span className="font-medium text-content-soft">não sincroniza</span> o financeiro local de
          ninguém.
        </p>
      </div>

      <div className={sectionCardClass}>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-content">Pedidos recebidos</h3>
          <button
            type="button"
            onClick={() => void loadRequests()}
            disabled={requestsLoading}
            className="inline-flex min-h-[40px] items-center justify-center rounded-design-md border border-edge bg-surface-muted px-3 text-xs font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 disabled:opacity-60"
          >
            {requestsLoading ? 'Atualizando…' : 'Atualizar lista'}
          </button>
        </div>

        {requestsError && (
          <div
            className="mb-4 rounded-design-md border border-edge bg-danger-soft px-4 py-3"
            role="alert"
          >
            <p className="text-sm font-semibold leading-snug text-danger">{requestsError}</p>
          </div>
        )}

        {requestsLoading && requests.length === 0 ? (
          <p className="text-center text-sm text-content-muted">Carregando pedidos…</p>
        ) : requests.length === 0 ? (
          <p className="text-sm leading-relaxed text-content-muted">
            Nenhum pedido recebido ainda. Quando um cliente vinculado enviar uma solicitação, ela
            aparece aqui.
          </p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => {
              const amount =
                typeof r.requestedAmount === 'number'
                  ? formatMoney(r.requestedAmount / 100)
                  : '—';
              const counterOfferMoney =
                typeof r.counterofferAmount === 'number'
                  ? formatMoney(r.counterofferAmount / 100)
                  : null;
              const statusLabel = getLoanRequestStatusLabelPt(r.status);
              const supplierNegotiation = isLoanRequestSupplierNegotiationStatesV1(r.status);
              const awaitingClientDecision = r.status === LOAN_REQUEST_STATUSES.COUNTEROFFER;
              const isTerminal = isLoanRequestTerminalStatusV1(r.status);
              const isPending = r.status === LOAN_REQUEST_STATUSES.PENDING;
              const isUnderReview = r.status === LOAN_REQUEST_STATUSES.UNDER_REVIEW;
              const expanded = expandedId === r.id;
              const busy = actingId === r.id;
              const showUnreadBadge = shouldShowUnreadBadgeSupplierPanel(r);
              const showLocalAvailableWarning = shouldShowLocalAvailableShortfall(
                r.status,
                r.requestedAmount,
                availableMoney,
              );
              const hasPlatformLink =
                (typeof r.linkId === 'string' && r.linkId.length > 0) ||
                (typeof r.clientId === 'string' && r.clientId.length > 0);
              const alreadyRegisteredLocally =
                r.status === LOAN_REQUEST_STATUSES.APPROVED &&
                hasConvertedLoanRequestDuplicate(clients, typeof r.id === 'string' ? r.id : '');

              return (
                <li
                  key={r.id}
                  className="rounded-design-md border border-edge bg-surface-muted px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (expanded) {
                        setNoteFor(r.id, '');
                        setCounterofferFor(r.id, '');
                      }
                      setExpandedId((prev) => (prev === r.id ? null : r.id));
                    }}
                    className="flex w-full flex-col gap-1 text-left"
                    aria-expanded={expanded}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-content">{amount}</p>
                      <div className="flex items-center gap-1.5">
                        {showUnreadBadge ? (
                          <span className="inline-block rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium leading-snug text-primary">
                            Novo
                          </span>
                        ) : null}
                        <p className="text-xs font-medium text-content-soft">{statusLabel}</p>
                      </div>
                    </div>
                    {counterOfferMoney ? (
                      <p className="text-xs text-content-muted">
                        Contraproposta na plataforma:{' '}
                        <span className="font-semibold text-content-soft">{counterOfferMoney}</span>
                      </p>
                    ) : null}
                    <p className="text-xs text-content-muted">
                      {hasPlatformLink ? (
                        <span className="font-medium text-content-soft">
                          {LOAN_REQUEST_SUPPLIER_ROW_CLIENT_CAPTION}
                        </span>
                      ) : (
                        <span className="text-content-soft">Solicitação sem vínculo completo na plataforma</span>
                      )}
                    </p>
                    <p className="text-xs text-content-muted">
                      Recebido em {formatRequestTimestamp(r.createdAt)} · toque para{' '}
                      {expanded ? 'fechar' : 'ver detalhes'}
                    </p>
                    {!expanded && hasFirestoreTimestampSeconds(r.readByClientAt) ? (
                      <p className="text-xs text-content-muted">Cliente já visualizou (registro opcional).</p>
                    ) : null}
                  </button>

                  {expanded ? (
                    <div className="mt-4 space-y-3 border-t border-edge/60 pt-4">
                      {showLocalAvailableWarning ? (
                        <div
                          className="rounded-design-md border border-warning/40 bg-warning/10 px-3 py-2.5"
                          role="status"
                        >
                          <p className="text-xs font-semibold leading-snug text-content-soft">
                            Total disponível local menor que o pedido.
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-content-muted">
                            Com base nos seus registros neste aparelho, o Total disponível é menor
                            que o valor solicitado. Aviso informativo: não valida saldo bancário nem
                            bloqueia a aprovação.
                          </p>
                        </div>
                      ) : null}
                      {typeof r.clientNote === 'string' && r.clientNote.length > 0 && (
                        <p className="text-xs leading-relaxed text-content-muted">
                          <span className="font-medium text-content-soft">Observação do cliente: </span>
                          {r.clientNote}
                        </p>
                      )}
                      {hasPlatformLink ? (
                        <p className="text-xs leading-relaxed text-content-muted">
                          {LOAN_REQUEST_SUPPLIER_EXPANDED_LINK_CAPTION}
                        </p>
                      ) : (
                        <p className="text-xs text-content-muted">
                          Vínculo na plataforma ausente ou incompleto neste registro.
                        </p>
                      )}
                      {hasFirestoreTimestampSeconds(r.readByClientAt) ? (
                        <p className="text-xs text-content-muted">
                          Cliente visualizou em {formatRequestTimestamp(r.readByClientAt)} — registro opcional na
                          plataforma (sem garantia jurídica ou mensagem obrigatória).
                        </p>
                      ) : null}
                      {typeof r.supplierNote === 'string' && r.supplierNote.length > 0 && (
                        <p className="text-xs leading-relaxed text-content-muted">
                          <span className="font-medium text-content-soft">Sua observação registrada: </span>
                          {r.supplierNote}
                        </p>
                      )}

                      {!isTerminal && awaitingClientDecision && (
                        <p className="text-xs leading-relaxed text-content-muted">
                          Você enviou uma <span className="font-medium text-content-soft">contraproposta</span>{' '}
                          neste pedido. Isso continua sendo apenas um fluxo pré-financeiro na plataforma —{' '}
                          <span className="font-medium text-content-soft">não abre contrato</span> no app do
                          cliente nem no seu, <span className="font-medium text-content-soft">não mexe em caixa</span>{' '}
                          nem sincroniza o financeiro local. Aguardando o cliente aceitar ou recusar a contraproposta.
                          {counterOfferMoney ? (
                            <span className="mt-1 block">
                              Valor contraposto:{' '}
                              <span className="font-semibold text-content-soft">{counterOfferMoney}</span>
                            </span>
                          ) : null}
                        </p>
                      )}

                      {isTerminal && r.status !== LOAN_REQUEST_STATUSES.APPROVED && (
                        <p className="text-xs leading-relaxed text-content-muted">
                          Pedido encerrado neste fluxo — não há ações disponíveis.
                        </p>
                      )}

                      {r.status === LOAN_REQUEST_STATUSES.APPROVED &&
                        (alreadyRegisteredLocally ? (
                          <div
                            className="rounded-design-md border border-edge/80 bg-surface-muted/30 px-3 py-2.5"
                            role="status"
                          >
                            <p className="text-xs font-medium leading-relaxed text-content-soft">
                              Contrato já registrado localmente
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-content-muted">
                              Este pedido já foi registrado no financeiro local neste aparelho.
                            </p>
                            <p className="mt-2 text-xs leading-relaxed text-content-muted">
                              Você pode encontrar o contrato na aba Clientes.
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-design-md border border-edge/80 bg-surface-muted/30 px-3 py-2.5">
                            <p className="text-xs leading-relaxed text-content-muted">
                              Pedido{' '}
                              <span className="font-medium text-content-soft">aprovado na plataforma</span>
                              {' — '}
                              ainda não existe contrato no app. Para registrar no seu financeiro local após a
                              transferência real, use o botão abaixo (revisão obrigatória).
                            </p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConvertReviewRequest(r);
                              }}
                              className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                            >
                              Registrar contrato local
                            </button>
                          </div>
                        ))}

                      {supplierNegotiation && (
                        <>
                          <div>
                            <label
                              htmlFor={`sr-note-${r.id}`}
                              className="mb-2 block text-sm font-medium text-content-soft"
                            >
                              Observação para o cliente (opcional)
                            </label>
                            <textarea
                              id={`sr-note-${r.id}`}
                              rows={2}
                              maxLength={LOAN_REQUEST_MAX_NOTE_CHARS}
                              value={supplierNoteFor(r.id)}
                              onChange={(e) => setNoteFor(r.id, e.target.value)}
                              disabled={busy}
                              className="w-full rounded-design-md border border-edge bg-surface px-4 py-2 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                              placeholder="Mensagem opcional junto à sua resposta"
                            />
                            <p className="mt-1 text-xs text-content-muted">
                              {supplierNoteFor(r.id).length}/{LOAN_REQUEST_MAX_NOTE_CHARS}
                            </p>
                          </div>

                          <div className="rounded-design-md border border-edge/80 bg-surface-muted/40 px-3 py-2">
                            <p className="mb-2 text-xs font-medium text-content-soft">
                              Contraproposta (opcional na plataforma)
                            </p>
                            <p className="mb-2 text-xs leading-relaxed text-content-muted">
                              Um valor diferente do solicitado. Não equivale a marcar este pedido como aprovado com
                              o mesmo valor solicitado nem a um contrato no aplicativo — é apenas negociação neste fluxo pré-financeiro.
                            </p>
                            <label
                              htmlFor={`sr-counter-${r.id}`}
                              className="mb-2 block text-sm font-medium text-content-soft"
                            >
                              Valor da contraproposta (R$)
                            </label>
                            <input
                              id={`sr-counter-${r.id}`}
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder="Ex.: 450,00"
                              disabled={busy}
                              value={counterofferDraftFor(r.id)}
                              onChange={(e) => setCounterofferFor(r.id, e.target.value)}
                              className="mb-3 min-h-[44px] w-full rounded-design-md border border-edge bg-surface px-4 py-2 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                            />
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void runSupplierCounteroffer(r.id)}
                              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                            >
                              {busy ? 'Enviando…' : 'Enviar contraproposta ao cliente'}
                            </button>
                          </div>

                          <div className="flex flex-col gap-2">
                            {isPending && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void runSupplierAction(r.id, 'under_review')}
                                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                              >
                                {busy ? 'Salvando…' : 'Marcar em análise'}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void runSupplierAction(r.id, 'approved')}
                              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md bg-primary px-3 text-sm font-semibold text-content-inverse shadow-design-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                            >
                              {busy ? 'Salvando…' : 'Aprovar pedido'}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void runSupplierAction(r.id, 'rejected')}
                              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                            >
                              {busy ? 'Salvando…' : 'Recusar pedido'}
                            </button>
                          </div>
                          {(isPending || isUnderReview) && (
                            <p className="text-xs leading-relaxed text-content-muted">
                              “Aprovar pedido” confirma a intenção na plataforma com o{' '}
                              <span className="font-medium text-content-soft">mesmo valor solicitado</span> pelo
                              cliente — não abre contrato no aplicativo. Para propor outro valor, use a contraproposta
                              acima.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConvertLoanRequestToContractReview
        open={convertReviewRequest != null}
        request={convertReviewRequest}
        defaultInterestRate={defaultInterestRate}
        clients={clients}
        onUpdateClients={onUpdateClients}
        onClose={() => setConvertReviewRequest(null)}
        showToast={showToast}
      />
    </div>
  );
}
