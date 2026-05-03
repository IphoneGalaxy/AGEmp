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

function hasFirestoreTimestampSeconds(ts) {
  return !!(ts && typeof ts === 'object' && typeof ts.seconds === 'number');
}

/**
 * @param {Object} props
 * @param {import('firebase/auth').User | null} props.user
 * @param {(msg: string) => void} [props.showToast]
 */
export default function LoanRequestsSupplierPanel({ user, showToast }) {
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [notesDraft, setNotesDraft] = useState({});
  const [counterofferInput, setCounterofferInput] = useState({});
  const [actingId, setActingId] = useState(null);

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
    const srSec =
      row.readBySupplierAt && typeof row.readBySupplierAt.seconds === 'number'
        ? row.readBySupplierAt.seconds
        : null;
    if (srSec != null) return;
    void markLoanRequestReadBySupplier({
      requestId: expandedId,
      supplierUid: user.uid,
    }).then((r) => {
      if (r.ok) void loadRequests();
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
        setExpandedId(null);
        setCounterofferFor(requestId, '');
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

              return (
                <li
                  key={r.id}
                  className="rounded-design-md border border-edge bg-surface-muted px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId((prev) => (prev === r.id ? null : r.id))}
                    className="flex w-full flex-col gap-1 text-left"
                    aria-expanded={expanded}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-content">{amount}</p>
                      <p className="text-xs font-medium text-content-soft">{statusLabel}</p>
                    </div>
                    {counterOfferMoney ? (
                      <p className="text-xs text-content-muted">
                        Contraproposta na plataforma:{' '}
                        <span className="font-semibold text-content-soft">{counterOfferMoney}</span>
                      </p>
                    ) : null}
                    <p className="text-xs text-content-muted">
                      Cliente (UID):{' '}
                      <span className="break-all font-medium text-content-soft">
                        {typeof r.clientId === 'string' ? r.clientId : '—'}
                      </span>
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
                      {typeof r.clientNote === 'string' && r.clientNote.length > 0 && (
                        <p className="text-xs leading-relaxed text-content-muted">
                          <span className="font-medium text-content-soft">Observação do cliente: </span>
                          {r.clientNote}
                        </p>
                      )}
                      <p className="text-xs text-content-muted">
                        Vínculo (linkId):{' '}
                        <span className="break-all font-mono text-content-soft">{r.linkId ?? '—'}</span>
                      </p>
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

                      {isTerminal && (
                        <p className="text-xs leading-relaxed text-content-muted">
                          Pedido encerrado neste fluxo — não há ações disponíveis.
                        </p>
                      )}

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
    </div>
  );
}
