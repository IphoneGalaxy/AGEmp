import React, { useCallback, useEffect, useState } from 'react';

import { formatMoney } from '../utils/format';
import { mapFirestoreError } from '../firebase/firestoreErrors';
import {
  listLoanRequestsForSupplier,
  supplierApproveLoanRequest,
  supplierMarkLoanRequestUnderReview,
  supplierRejectLoanRequest,
} from '../firebase/loanRequestsFirestore';
import {
  LOAN_REQUEST_MAX_NOTE_CHARS,
  LOAN_REQUEST_STATUSES,
  getLoanRequestStatusLabelPt,
  isLoanRequestOpenStatusV1,
} from '../firebase/loanRequests';

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

  const setNoteFor = (id, value) => {
    setNotesDraft((prev) => ({ ...prev, [id]: value }));
  };

  const supplierNoteFor = (id) => notesDraft[id] ?? '';

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
              const statusLabel = getLoanRequestStatusLabelPt(r.status);
              const isOpen = typeof r.status === 'string' && isLoanRequestOpenStatusV1(r.status);
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
                      {typeof r.supplierNote === 'string' && r.supplierNote.length > 0 && (
                        <p className="text-xs leading-relaxed text-content-muted">
                          <span className="font-medium text-content-soft">Sua observação registrada: </span>
                          {r.supplierNote}
                        </p>
                      )}

                      {!isOpen && (
                        <p className="text-xs leading-relaxed text-content-muted">
                          Pedido encerrado — não há ações disponíveis neste fluxo.
                        </p>
                      )}

                      {isOpen && (
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
                              Aprovar apenas confirma a intenção na plataforma com o mesmo valor
                              solicitado — não abre contrato no aplicativo.
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
