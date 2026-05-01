import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { formatMoney } from '../utils/format';
import { normalizeNoteForLoanRequest, parseBrlMoneyInputToCents } from '../utils/brlMoneyInput';
import { mapFirestoreError } from '../firebase/firestoreErrors';
import {
  cancelLoanRequestByClient,
  createLoanRequest,
  findOpenLoanRequestForLinkId,
  listLoanRequestsForClient,
} from '../firebase/loanRequestsFirestore';
import {
  LOAN_REQUEST_MAX_AMOUNT_CENTS,
  LOAN_REQUEST_MAX_NOTE_CHARS,
  LOAN_REQUEST_MIN_AMOUNT_CENTS,
  getLoanRequestStatusLabelPt,
  isLoanRequestOpenStatusV1,
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
      const dup = await findOpenLoanRequestForLinkId(draftLinkId);
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
          <p className="text-sm text-content-muted">
            Você ainda não enviou pedidos ou a lista está vazia neste aparelho.
          </p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => {
              const amount =
                typeof r.requestedAmount === 'number'
                  ? formatMoney(r.requestedAmount / 100)
                  : '—';
              const statusLabel = getLoanRequestStatusLabelPt(r.status);
              const canCancel =
                typeof r.status === 'string' && isLoanRequestOpenStatusV1(r.status);
              const busy = cancellingId === r.id;
              return (
                <li
                  key={r.id}
                  className="rounded-design-md border border-edge bg-surface-muted px-4 py-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-content">{amount}</p>
                    <p className="text-xs font-medium text-content-soft">{statusLabel}</p>
                  </div>
                  <p className="mt-1 text-xs text-content-muted">
                    Enviado em {formatRequestTimestamp(r.createdAt)}
                  </p>
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
