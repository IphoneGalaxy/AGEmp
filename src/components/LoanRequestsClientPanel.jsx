import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { formatMoney } from '../utils/format';
import { normalizeNoteForLoanRequest, parseBrlMoneyInputToCents } from '../utils/brlMoneyInput';
import { mapFirestoreError } from '../firebase/firestoreErrors';
import {
  cancelLoanRequestByClient,
  clientAcceptLoanRequestCounteroffer,
  clientDeclineLoanRequestCounteroffer,
  createLoanRequest,
  findOpenLoanRequestForLinkId,
  listLoanRequestsForClient,
  markLoanRequestReadByClient,
} from '../firebase/loanRequestsFirestore';
import {
  LOAN_REQUEST_MAX_AMOUNT_CENTS,
  LOAN_REQUEST_MAX_NOTE_CHARS,
  LOAN_REQUEST_MIN_AMOUNT_CENTS,
  LOAN_REQUEST_STATUSES,
  getLoanRequestStatusLabelPt,
  canClientCancelLoanRequestV1,
  isLoanRequestTerminalStatusV1,
} from '../firebase/loanRequests';
import { LINK_STATUSES } from '../firebase/links';

const sectionCardClass =
  'rounded-design-lg border border-edge bg-surface p-5 shadow-design-sm sm:p-6';

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

/** @returns {boolean} */
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

/**
 * Último instante documentado de ação relevante do fornecedor (badge "Novo" do cliente).
 * @param {Record<string, unknown>} r
 * @returns {number | null}
 */
function getSupplierEventSecondsForClientBadge(r) {
  const status = typeof r.status === 'string' ? r.status : '';
  if (status === LOAN_REQUEST_STATUSES.PENDING) return null;
  if (status === LOAN_REQUEST_STATUSES.CANCELLED_BY_CLIENT) return null;
  if (status === LOAN_REQUEST_STATUSES.COUNTEROFFER_DECLINED) return null;

  const updatedAt = firestoreTimestampSecondsOrNull(r.updatedAt);
  const respondedAt = firestoreTimestampSecondsOrNull(r.respondedAt);
  const counterofferedAt = firestoreTimestampSecondsOrNull(r.counterofferedAt);

  if (status === LOAN_REQUEST_STATUSES.COUNTEROFFER) {
    return maxSecondsOrNull([counterofferedAt, updatedAt]);
  }
  if (status === LOAN_REQUEST_STATUSES.APPROVED) {
    const viaCounteroffer =
      typeof r.approvedAmount === 'number' &&
      typeof r.requestedAmount === 'number' &&
      r.approvedAmount !== r.requestedAmount;
    if (viaCounteroffer) {
      return counterofferedAt;
    }
    return maxSecondsOrNull([respondedAt, updatedAt]);
  }
  if (status === LOAN_REQUEST_STATUSES.REJECTED) {
    return maxSecondsOrNull([respondedAt, updatedAt]);
  }
  if (status === LOAN_REQUEST_STATUSES.UNDER_REVIEW) {
    return maxSecondsOrNull([updatedAt]);
  }
  return maxSecondsOrNull([updatedAt, respondedAt, counterofferedAt]);
}

/**
 * @param {Record<string, unknown>} r
 * @returns {boolean}
 */
function shouldShowUnreadBadgeClientPanel(r) {
  const supplierEvt = getSupplierEventSecondsForClientBadge(r);
  if (supplierEvt == null) return false;
  const readSec = firestoreTimestampSecondsOrNull(r.readByClientAt);
  const status = typeof r.status === 'string' ? r.status : '';

  if (readSec != null) {
    return supplierEvt > readSec;
  }

  // Legado pré-v1.1 RB: pedidos encerrados sem readByClientAt não devem
  // repetir eternamente "Novo" (similar ao painel do fornecedor).
  if (isLoanRequestTerminalStatusV1(status)) {
    return false;
  }

  return true;
}

/**
 * @param {Object} props
 * @param {string} props.requestId
 * @param {string} props.clientUid
 * @param {unknown} props.readByClientAt
 * @param {number | null} props.supplierEventSeconds
 * @param {string} [props.requestStatus]
 * @param {() => void} [props.onMarked]
 */
function ClientLoanRequestReadEffect({ requestId, clientUid, readByClientAt, supplierEventSeconds, requestStatus, onMarked }) {
  const readClientSec = firestoreTimestampSecondsOrNull(readByClientAt);

  useEffect(() => {
    if (!requestId || !clientUid) {
      return;
    }
    let needMark;
    if (supplierEventSeconds == null) {
      needMark = readClientSec == null;
    } else {
      needMark = readClientSec == null || supplierEventSeconds > readClientSec;
    }
    // Legado pré-v1.1 RB: pedidos encerrados sem readByClientAt não precisam
    // de marcação só por aparecerem na lista.
    if (
      needMark &&
      readClientSec == null &&
      isLoanRequestTerminalStatusV1(requestStatus ?? '')
    ) {
      needMark = false;
    }
    if (!needMark) {
      return;
    }
    /** Com novidade do fornecedor o mark imediato apagava o "Novo" antes de pintar. */
    const delayMs = supplierEventSeconds != null ? 850 : 0;
    const t = window.setTimeout(() => {
      void markLoanRequestReadByClient({ requestId, clientUid }).then((res) => {
        if (res.ok && typeof onMarked === 'function') {
          onMarked();
        }
      });
    }, delayMs);
    return () => window.clearTimeout(t);
  }, [requestId, clientUid, readClientSec, supplierEventSeconds, requestStatus, onMarked]);

  return null;
}

/**
 * @param {Object} props
 * @param {import('firebase/auth').User | null} props.user
 * @param {(msg: string) => void} [props.showToast]
 * @param {Array<{ id: string; supplierId?: string; clientId?: string; status?: string }>} props.links
 * @param {boolean} props.linksLoading
 */
export default function LoanRequestsClientPanel({ user, showToast, links, linksLoading }) {
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState('');

  const [draftLinkId, setDraftLinkId] = useState(null);
  const [amountInput, setAmountInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [cancellingId, setCancellingId] = useState(null);
  const [counterofferBusyId, setCounterofferBusyId] = useState(null);

  const approvedAsClient = useMemo(
    () =>
      (links ?? []).filter(
        (l) =>
          l?.clientId === user?.uid &&
          l?.supplierId &&
          String(l.status) === LINK_STATUSES.APPROVED,
      ),
    [links, user?.uid],
  );

  const loadRequests = useCallback(async () => {
    if (!user?.uid) {
      setRequests([]);
      return;
    }
    setRequestsLoading(true);
    setRequestsError('');
    try {
      const list = await listLoanRequestsForClient(user.uid);
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

  const beginDraft = (linkId /* string */) => {
    setDraftLinkId(linkId);
    setAmountInput('');
    setNoteInput('');
    setFormError('');
  };

  const cancelDraft = () => {
    setDraftLinkId(null);
    setAmountInput('');
    setNoteInput('');
    setFormError('');
  };

  const handleSubmitRequest = async () => {
    if (!user?.uid || !draftLinkId) return;

    setFormError('');
    const link = approvedAsClient.find((l) => l.id === draftLinkId);
    if (!link?.supplierId) {
      setFormError('Vínculo inválido.');
      return;
    }

    const parsed = parseBrlMoneyInputToCents(amountInput, {
      minCents: LOAN_REQUEST_MIN_AMOUNT_CENTS,
      maxCents: LOAN_REQUEST_MAX_AMOUNT_CENTS,
    });
    if (!parsed.ok) {
      setFormError(parsed.message);
      return;
    }

    const note = normalizeNoteForLoanRequest(noteInput, LOAN_REQUEST_MAX_NOTE_CHARS);

    setSubmitting(true);
    try {
      const dup = await findOpenLoanRequestForLinkId(draftLinkId, user.uid);
      if (dup.exists) {
        setFormError(
          'Já existe um pedido em aberto para este fornecedor. Aguarde resposta ou cancele o pedido anterior.',
        );
        return;
      }

      const result = await createLoanRequest({
        supplierId: link.supplierId,
        clientId: user.uid,
        linkId: draftLinkId,
        requestedAmountCents: parsed.cents,
        clientNote: note,
      });

      if (result.ok) {
        showToast?.('Pedido enviado. Acompanhe o status abaixo.');
        cancelDraft();
        await loadRequests();
      } else {
        setFormError(result.message);
      }
    } catch (e) {
      setFormError(mapFirestoreError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async (requestId) => {
    if (!requestId) return;
    setCancellingId(requestId);
    try {
      const result = await cancelLoanRequestByClient({ requestId });
      if (result.ok) {
        showToast?.('Pedido cancelado.');
        await loadRequests();
      } else {
        showToast?.(result.message);
      }
    } catch (e) {
      showToast?.(mapFirestoreError(e));
    } finally {
      setCancellingId(null);
    }
  };

  const handleAcceptCounteroffer = async (requestId) => {
    if (!requestId || !user?.uid) return;
    setCounterofferBusyId(requestId);
    try {
      const result = await clientAcceptLoanRequestCounteroffer({
        requestId,
        clientUid: user.uid,
      });
      if (result.ok) {
        showToast?.(
          'Você aceitou o valor contraposto na plataforma. Isso não cria contrato no aplicativo nem altera seu financeiro local.',
        );
        await loadRequests();
      } else {
        showToast?.(result.message);
      }
    } catch (e) {
      showToast?.(mapFirestoreError(e));
    } finally {
      setCounterofferBusyId(null);
    }
  };

  const handleDeclineCounteroffer = async (requestId) => {
    if (!requestId || !user?.uid) return;
    setCounterofferBusyId(requestId);
    try {
      const result = await clientDeclineLoanRequestCounteroffer({
        requestId,
        clientUid: user.uid,
      });
      if (result.ok) {
        showToast?.(
          'Contraproposta recusada. O pedido fica encerrado neste fluxo pré-financeiro (sem criar contrato no app).',
        );
        await loadRequests();
      } else {
        showToast?.(result.message);
      }
    } catch (e) {
      showToast?.(mapFirestoreError(e));
    } finally {
      setCounterofferBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className={sectionCardClass}>
        <h3 className="mb-2 text-base font-semibold text-content">Sobre estes pedidos</h3>
        <p className="text-xs leading-relaxed text-content-muted">
          Solicitação enviada ao fornecedor na plataforma. Isso{' '}
          <span className="font-medium text-content-soft">não cria contrato</span> no app,{' '}
          <span className="font-medium text-content-soft">não altera caixa</span> e{' '}
          <span className="font-medium text-content-soft">não sincroniza</span> seu financeiro local
          com a nuvem.
        </p>
      </div>

      <div className={sectionCardClass}>
        <h3 className="mb-1 text-base font-semibold text-content">Fornecedores com vínculo aprovado</h3>
        <p className="mb-4 text-xs leading-relaxed text-content-muted">
          Só é possível pedir quando o vínculo com o fornecedor está aprovado em Conta → Vínculos.
        </p>

        {linksLoading ? (
          <p className="text-center text-sm text-content-muted">Carregando vínculos…</p>
        ) : approvedAsClient.length === 0 ? (
          <p className="text-sm leading-relaxed text-content-muted">
            Nenhum fornecedor com vínculo aprovado. Peça o vínculo em Conta e aguarde o fornecedor
            aprovar antes de enviar um pedido.
          </p>
        ) : (
          <ul className="space-y-4">
            {approvedAsClient.map((link) => (
              <li
                key={link.id}
                className="rounded-design-md border border-edge bg-surface-muted px-4 py-3"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-content-muted">
                  Fornecedor (UID)
                </p>
                <p className="mt-0.5 break-all text-sm font-medium text-content">{link.supplierId}</p>

                {draftLinkId === link.id ? (
                  <div className="mt-4 space-y-3">
                    {formError && (
                      <div
                        className="rounded-design-md border border-edge bg-danger-soft px-3 py-2"
                        role="alert"
                      >
                        <p className="text-sm font-semibold leading-snug text-danger">{formError}</p>
                      </div>
                    )}
                    <div>
                      <label
                        htmlFor={`lr-amount-${link.id}`}
                        className="mb-2 block text-sm font-medium text-content-soft"
                      >
                        Valor solicitado (R$)
                      </label>
                      <input
                        id={`lr-amount-${link.id}`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        disabled={submitting}
                        placeholder="Ex.: 500,00"
                        className="min-h-[44px] w-full rounded-design-md border border-edge bg-surface px-4 py-2 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`lr-note-${link.id}`}
                        className="mb-2 block text-sm font-medium text-content-soft"
                      >
                        Observação (opcional)
                      </label>
                      <textarea
                        id={`lr-note-${link.id}`}
                        rows={3}
                        maxLength={LOAN_REQUEST_MAX_NOTE_CHARS}
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        disabled={submitting}
                        placeholder="Mensagem para o fornecedor (máx. 1000 caracteres)"
                        className="w-full rounded-design-md border border-edge bg-surface px-4 py-2 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                      />
                      <p className="mt-1 text-xs text-content-muted">
                        {noteInput.length}/{LOAN_REQUEST_MAX_NOTE_CHARS}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleSubmitRequest}
                        className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-design-md bg-primary px-4 text-sm font-semibold text-content-inverse shadow-design-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                      >
                        {submitting ? 'Enviando…' : 'Enviar pedido'}
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={cancelDraft}
                        className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-design-md border border-edge bg-surface px-4 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => beginDraft(link.id)}
                    className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                  >
                    Enviar pedido a este fornecedor
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={sectionCardClass}>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-content">Meus pedidos enviados</h3>
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
            Nenhum pedido enviado ainda. Depois que você enviar um pedido a um fornecedor com vínculo
            aprovado, ele aparece aqui para acompanhamento.
          </p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => {
              const requestedMoney =
                typeof r.requestedAmount === 'number'
                  ? formatMoney(r.requestedAmount / 100)
                  : '—';
              const counterofferMoney =
                typeof r.counterofferAmount === 'number'
                  ? formatMoney(r.counterofferAmount / 100)
                  : null;
              const statusLabel = getLoanRequestStatusLabelPt(r.status);
              const canCancel =
                typeof r.status === 'string' && canClientCancelLoanRequestV1(r.status);
              const isCounteroffer = r.status === LOAN_REQUEST_STATUSES.COUNTEROFFER;
              const isApproved = r.status === LOAN_REQUEST_STATUSES.APPROVED;
              const declinedCounteroffer =
                r.status === LOAN_REQUEST_STATUSES.COUNTEROFFER_DECLINED;
              const supplierEventSeconds = getSupplierEventSecondsForClientBadge(r);
              const showUnreadBadge = shouldShowUnreadBadgeClientPanel(r);
              const approvedViaCounteroffer =
                isApproved &&
                typeof r.approvedAmount === 'number' &&
                typeof r.requestedAmount === 'number' &&
                r.approvedAmount !== r.requestedAmount;
              const showRespondedAt =
                r.status === LOAN_REQUEST_STATUSES.APPROVED ||
                r.status === LOAN_REQUEST_STATUSES.REJECTED ||
                declinedCounteroffer;
              const busy = cancellingId === r.id;
              const counterBusy = counterofferBusyId === r.id;
              return (
                <li
                  key={r.id}
                  className="rounded-design-md border border-edge bg-surface-muted px-4 py-3"
                >
                  <ClientLoanRequestReadEffect
                    requestId={r.id}
                    clientUid={user.uid}
                    readByClientAt={r.readByClientAt}
                    supplierEventSeconds={supplierEventSeconds}
                    requestStatus={r.status}
                    onMarked={loadRequests}
                  />
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-content">{requestedMoney}</p>
                      <p className="text-xs text-content-muted">
                        Valor que você solicitou
                        {isCounteroffer && counterofferMoney ? (
                          <span className="mt-0.5 block font-medium text-content-soft">
                            Valor contraposto pelo fornecedor: {counterofferMoney}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {showUnreadBadge ? (
                        <span className="inline-block rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium leading-snug text-primary">
                          Novo
                        </span>
                      ) : null}
                      <p className="text-xs font-medium text-content-soft">{statusLabel}</p>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-content-muted">
                    Enviado em {formatRequestTimestamp(r.createdAt)}
                  </p>
                  {hasFirestoreTimestampSeconds(r.readBySupplierAt) ? (
                    <p className="mt-2 text-xs text-content-muted">
                      Fornecedor visualizou em {formatRequestTimestamp(r.readBySupplierAt)} (registro na
                      plataforma — sem promessa de mensagem obrigatória).
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs font-medium uppercase tracking-wide text-content-muted">
                    Fornecedor (UID)
                  </p>
                  <p className="break-all text-xs text-content-soft">
                    {typeof r.supplierId === 'string' ? r.supplierId : '—'}
                  </p>
                  {typeof r.clientNote === 'string' && r.clientNote.length > 0 && (
                    <p className="mt-2 text-xs leading-relaxed text-content-muted">
                      <span className="font-medium text-content-soft">Sua observação: </span>
                      {r.clientNote}
                    </p>
                  )}
                  {typeof r.supplierNote === 'string' && r.supplierNote.length > 0 && (
                    <p className="mt-2 text-xs leading-relaxed text-content-muted">
                      <span className="font-medium text-content-soft">Mensagem do fornecedor: </span>
                      {r.supplierNote}
                    </p>
                  )}
                  {showRespondedAt && (
                    <p className="mt-1 text-xs text-content-muted">
                      Resposta em {formatRequestTimestamp(r.respondedAt)}
                    </p>
                  )}
                  {declinedCounteroffer && (
                    <p className="mt-2 rounded-design-sm border border-edge/70 bg-surface px-2 py-1.5 text-xs leading-relaxed text-content-muted">
                      Você encerrou este pedido ao recusar a contraproposta. Fluxo apenas pré-financeiro na
                      plataforma — <span className="font-medium text-content-soft">não cria contrato</span> no app
                      nem sincroniza financeiro local.
                    </p>
                  )}
                  {isCounteroffer ? (
                    <div className="mt-3 space-y-2 rounded-design-md border border-edge/80 bg-surface px-3 py-2">
                      {counterofferMoney ? (
                        <>
                          <p className="text-xs font-medium text-content-soft">
                            Decidir sobre a contraproposta
                          </p>
                          <ul className="list-inside list-disc space-y-1 text-xs text-content-muted">
                            <li>Valor solicitado: {requestedMoney}</li>
                            <li>Valor contraposto: {counterofferMoney}</li>
                          </ul>
                          <p className="text-xs leading-relaxed text-content-muted">
                            Aceitar confirma o{' '}
                            <span className="font-medium text-content-soft">valor contraposto</span> como intenção
                            na plataforma. Isso{' '}
                            <span className="font-medium text-content-soft">
                              não cria contrato no aplicativo, não altera caixa nem grava financeiro na nuvem
                            </span>
                            .
                          </p>
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              disabled={counterBusy}
                              onClick={() => void handleAcceptCounteroffer(r.id)}
                              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md bg-primary px-3 text-sm font-semibold text-content-inverse shadow-design-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                            >
                              {counterBusy ? 'Salvando…' : 'Aceitar valor contraposto'}
                            </button>
                            <button
                              type="button"
                              disabled={counterBusy}
                              onClick={() => void handleDeclineCounteroffer(r.id)}
                              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                            >
                              {counterBusy ? 'Salvando…' : 'Recusar contraproposta'}
                            </button>
                          </div>
                          <p className="text-[11px] leading-relaxed text-content-muted">
                            Enquanto houver uma contraproposta pendente, o cancelamento do pedido fica indisponível
                            nesta tela — escolha aceitar ou recusar.
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-content-muted">
                          Há uma contraproposta pendente, mas o valor ainda não pôde ser exibido. Atualize a lista ou tente novamente em instantes.
                        </p>
                      )}
                    </div>
                  ) : null}
                  {isApproved && (
                    <p className="mt-2 rounded-design-sm border border-edge/70 bg-surface px-2 py-1.5 text-xs leading-relaxed text-content-muted">
                      {approvedViaCounteroffer ? (
                        <>
                          Aprovação referente ao <span className="font-medium text-content-soft">valor contraposto</span>{' '}
                          ({typeof r.approvedAmount === 'number' ? formatMoney(r.approvedAmount / 100) : '—'}) na
                          plataforma —{' '}
                          <span className="font-medium text-content-soft">não cria contrato</span> no app nem altera
                          caixa.
                        </>
                      ) : (
                        <>
                          Aprovação na plataforma{' '}
                          <span className="font-medium text-content-soft">não cria contrato</span> no app nem altera
                          caixa — combine os próximos passos fora deste fluxo, se precisar.
                        </>
                      )}
                    </p>
                  )}
                  {canCancel && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleCancelRequest(r.id)}
                      className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
                    >
                      {busy ? 'Cancelando…' : 'Cancelar pedido'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
