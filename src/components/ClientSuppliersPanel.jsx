import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { formatMoney } from '../utils/format';
import {
  deriveLedgerTotals,
  deriveSupplierTotals,
  findSupplierEntry,
  normalizeClientDebtLedger,
} from '../utils/clientDebtLedger';
import { normalizeNoteForLoanRequest, parseBrlMoneyInputToCents } from '../utils/brlMoneyInput';
import { mapFirestoreError } from '../firebase/firestoreErrors';
import {
  createLoanRequest,
  findOpenLoanRequestForLinkId,
  listLoanRequestsForClient,
} from '../firebase/loanRequestsFirestore';
import {
  LOAN_REQUEST_MAX_AMOUNT_CENTS,
  LOAN_REQUEST_MAX_NOTE_CHARS,
  LOAN_REQUEST_MIN_AMOUNT_CENTS,
  LOAN_REQUEST_STATUSES,
  getLoanRequestStatusLabelPt,
} from '../firebase/loanRequests';
import { LINK_STATUSES } from '../firebase/links';
import {
  deriveApprovedLinkSupplierFriendlyName,
  deriveLoanRequestSupplierFriendlyName,
} from '../utils/displayNameSnapshots';
import { groupLoanRequestsBySupplierId } from '../utils/groupLoanRequestsBySupplierId';
import { useSupplierDisplayNameMap } from '../hooks/useSupplierDisplayNameMap';
import ClientSupplierDebtDetail from './ClientSupplierDebtDetail';

const sectionCardClass =
  'rounded-design-lg border border-edge bg-surface p-5 shadow-design-sm sm:p-6';

/**
 * Resumo local «eu devo» para um vínculo (supplierId + linkId).
 *
 * @param {Object} props
 * @param {string} props.supplierId
 * @param {string} props.linkId
 * @param {import('../utils/clientDebtLedger').ClientDebtLedger} props.ledgerNorm
 * @param {Date} props.refDate
 * @param {(n: number) => string} props.displayMoney
 */
function LocalSupplierDebtStrip({ supplierId, linkId, ledgerNorm, refDate, displayMoney }) {
  const totals = useMemo(() => {
    const entry = findSupplierEntry(ledgerNorm, supplierId, linkId);
    const stub = { id: '_stub', supplierId, linkId, debts: [] };
    return deriveSupplierTotals(entry ?? stub, refDate);
  }, [ledgerNorm, supplierId, linkId, refDate]);

  const hasActiveLocal = totals.activeDebts > 0 || totals.openPrincipal > 0;

  return (
    <div className="mt-3 rounded-design-sm border border-primary/20 bg-primary-soft/20 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
        Minhas dívidas neste aparelho
      </p>
      {!hasActiveLocal ? (
        <p className="mt-2 text-xs leading-relaxed text-content-muted">
          Nenhum registro local de dívida para este fornecedor. Valores aprovados na plataforma não
          entram aqui automaticamente — você poderá registrar no financeiro local em uma próxima
          etapa.
        </p>
      ) : (
        <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-content-muted">Principal (posição no livro)</dt>
            <dd className="font-semibold text-content">{displayMoney(totals.openPrincipal)}</dd>
          </div>
          <div>
            <dt className="text-content-muted">Juros estimados (mês)</dt>
            <dd className="font-semibold text-content">{displayMoney(totals.estimatedMonthlyInterest)}</dd>
          </div>
          <div>
            <dt className="text-content-muted">Quitação estimada</dt>
            <dd className="font-semibold text-content">{displayMoney(totals.estimatedSettlement)}</dd>
          </div>
          <div className="sm:col-span-3">
            <dt className="text-content-muted">Dívidas ativas (local)</dt>
            <dd className="font-semibold text-content">{totals.activeDebts}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

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
 * @param {string} [props.supplierId]
 */
function SupplierUidDetails({ supplierId }) {
  if (typeof supplierId !== 'string' || supplierId.length === 0) {
    return null;
  }
  return (
    <details className="mt-2 rounded-design-sm border border-edge/70 bg-surface/60 px-2 py-1">
      <summary className="cursor-pointer select-none text-[11px] font-medium text-content-muted underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring">
        Identificador técnico da conta (opcional)
      </summary>
      <p className="mt-1 break-all font-mono text-[11px] leading-snug text-content-muted">{supplierId}</p>
    </details>
  );
}

/**
 * Visão mínima “Fornecedores” no lado cliente: vínculos aprovados + pedidos pré-financeiros agrupados.
 *
 * @param {Object} props
 * @param {import('firebase/auth').User | null} props.user
 * @param {(msg: string) => void} [props.showToast]
 * @param {Array<{ id: string; supplierId?: string; clientId?: string; status?: string }>} props.links
 * @param {boolean} props.linksLoading
 * @param {() => void} [props.onOpenSolicitations]
 * @param {import('../utils/clientDebtLedger').ClientDebtLedger} [props.clientDebtLedger]
 * @param {Date} [props.ledgerReferenceDate]
 * @param {(n: number) => string} [props.displayMoney]
 * @param {(updater: (prev: import('../utils/clientDebtLedger').ClientDebtLedger) => import('../utils/clientDebtLedger').ClientDebtLedger) => void} [props.onUpdateClientDebtLedger]
 */
export default function ClientSuppliersPanel({
  user,
  showToast,
  links,
  linksLoading,
  onOpenSolicitations,
  clientDebtLedger,
  ledgerReferenceDate,
  displayMoney: displayMoneyProp,
  onUpdateClientDebtLedger,
}) {
  const displayMoney =
    typeof displayMoneyProp === 'function' ? displayMoneyProp : (n) => formatMoney(n);

  const refDate = useMemo(() => {
    const d = ledgerReferenceDate;
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
    return new Date();
  }, [ledgerReferenceDate]);

  const ledgerNorm = useMemo(() => normalizeClientDebtLedger(clientDebtLedger), [clientDebtLedger]);

  const globalTotals = useMemo(() => deriveLedgerTotals(ledgerNorm, refDate), [ledgerNorm, refDate]);
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState('');

  const [draftLinkId, setDraftLinkId] = useState(null);
  const [amountInput, setAmountInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [supplierDetail, setSupplierDetail] = useState(null);

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

  const groupedBySupplier = useMemo(() => groupLoanRequestsBySupplierId(requests), [requests]);

  const supplierIdsForDisplayNames = useMemo(() => {
    const s = new Set();
    for (const l of approvedAsClient) {
      if (l.supplierId) s.add(l.supplierId);
    }
    for (const r of requests) {
      if (typeof r.supplierId === 'string' && r.supplierId.trim()) {
        s.add(r.supplierId.trim());
      }
    }
    return [...s];
  }, [approvedAsClient, requests]);

  const { supplierDisplayNames } = useSupplierDisplayNameMap(supplierIdsForDisplayNames);

  const sortedApprovedLinks = useMemo(() => {
    const copy = [...approvedAsClient];
    copy.sort((a, b) => {
      const na = deriveApprovedLinkSupplierFriendlyName(a, supplierDisplayNames[a.supplierId]);
      const nb = deriveApprovedLinkSupplierFriendlyName(b, supplierDisplayNames[b.supplierId]);
      return na.localeCompare(nb, 'pt-BR', { sensitivity: 'base' });
    });
    return copy;
  }, [approvedAsClient, supplierDisplayNames]);

  const orphanSupplierIds = useMemo(() => {
    const approvedSet = new Set(
      approvedAsClient.map((l) => (typeof l.supplierId === 'string' ? l.supplierId : '')).filter(Boolean),
    );
    return Object.keys(groupedBySupplier).filter((id) => !approvedSet.has(id));
  }, [approvedAsClient, groupedBySupplier]);

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

  const beginDraft = (linkId) => {
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
        showToast?.('Pedido enviado na plataforma (pré-financeiro).');
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

  const renderRequestRow = (r) => {
    const requestedMoney =
      typeof r.requestedAmount === 'number' ? formatMoney(r.requestedAmount / 100) : '—';
    const counterofferMoney =
      typeof r.counterofferAmount === 'number' ? formatMoney(r.counterofferAmount / 100) : null;
    const statusLabel = getLoanRequestStatusLabelPt(r.status);
    const isCounteroffer = r.status === LOAN_REQUEST_STATUSES.COUNTEROFFER;
    const sid = typeof r.supplierId === 'string' ? r.supplierId : '';

    return (
      <li
        key={r.id}
        className="rounded-design-md border border-edge bg-surface-muted px-3 py-2"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-content">{requestedMoney}</p>
            <p className="text-[11px] text-content-muted">
              Solicitado · pré-financeiro na plataforma
              {isCounteroffer && counterofferMoney ? (
                <span className="mt-0.5 block font-medium text-content-soft">
                  Contraproposta: {counterofferMoney}
                </span>
              ) : null}
            </p>
          </div>
          <p className="text-[11px] font-medium text-content-soft">{statusLabel}</p>
        </div>
        <p className="mt-1 text-[11px] text-content-muted">
          Enviado em {formatRequestTimestamp(r.createdAt)}
        </p>
        <p className="mt-1 text-[11px] font-medium text-content-soft">
          {deriveLoanRequestSupplierFriendlyName(r, supplierDisplayNames[sid])}
        </p>
        {isCounteroffer ? (
          <p className="mt-2 text-[11px] leading-relaxed text-content-muted">
            Há contraproposta pendente — para aceitar, recusar ou cancelar, use{' '}
            <span className="font-medium text-content-soft">Solicitações</span> na Conta.
          </p>
        ) : null}
      </li>
    );
  };

  const renderSupplierSection = (linkOrNull, supplierId, headingName) => {
    const linkId = linkOrNull?.id ?? null;
    const sid =
      supplierId ||
      (typeof linkOrNull?.supplierId === 'string' ? linkOrNull.supplierId : '');
    const rows = groupedBySupplier[sid] ?? [];

    return (
      <section
        key={sid || headingName}
        className="rounded-design-md border border-edge bg-surface-muted px-4 py-4"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-content-muted">
          Fornecedor na plataforma
        </p>
        <h4 className="mt-0.5 text-base font-semibold text-content">{headingName}</h4>

        {linkId ? (
          <LocalSupplierDebtStrip
            supplierId={sid}
            linkId={linkId}
            ledgerNorm={ledgerNorm}
            refDate={refDate}
            displayMoney={displayMoney}
          />
        ) : (
          <div className="mt-3 rounded-design-sm border border-edge/80 bg-surface/40 px-3 py-2">
            <p className="text-[11px] leading-relaxed text-content-muted">
              Resumo de dívidas locais por fornecedor aparece quando há vínculo aprovado associado a
              esta linha.
            </p>
          </div>
        )}

        {linkId && linkOrNull && typeof onUpdateClientDebtLedger === 'function' ? (
          <button
            type="button"
            onClick={() => setSupplierDetail({ link: linkOrNull, headingName })}
            className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-primary/40 bg-surface px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            Ver detalhes
          </button>
        ) : null}

        <p className="mt-2 text-[11px] leading-relaxed text-content-muted">
          Vínculo aprovado entre contas na plataforma. Os pedidos abaixo são só intenção pré-financeira
          remota —{' '}
          <span className="font-medium text-content-soft">
            não criam contrato local, não alteram caixa e não sincronizam
          </span>{' '}
          seu financeiro neste aparelho.
        </p>

        <SupplierUidDetails supplierId={sid} />

        {rows.length === 0 ? (
          <p className="mt-3 text-xs text-content-muted">Nenhum pedido enviado a este fornecedor ainda.</p>
        ) : (
          <ul className="mt-3 space-y-2">{rows.map((row) => renderRequestRow(row))}</ul>
        )}

        {linkId ? (
          draftLinkId === linkId ? (
            <div className="mt-4 space-y-3 border-t border-edge pt-4">
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
                  htmlFor={`cs-amount-${linkId}`}
                  className="mb-2 block text-sm font-medium text-content-soft"
                >
                  Valor solicitado (R$)
                </label>
                <input
                  id={`cs-amount-${linkId}`}
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
                  htmlFor={`cs-note-${linkId}`}
                  className="mb-2 block text-sm font-medium text-content-soft"
                >
                  Observação (opcional)
                </label>
                <textarea
                  id={`cs-note-${linkId}`}
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
              onClick={() => beginDraft(linkId)}
              className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
            >
              Solicitar novo valor
            </button>
          )
        ) : (
          <p className="mt-4 text-[11px] leading-relaxed text-content-muted">
            Não há vínculo aprovado associado a este fornecedor nesta conta — gerencie vínculos em{' '}
            <span className="font-medium text-content-soft">Conta → Vínculos</span>. Para novos pedidos
            neste fluxo é preciso um vínculo aprovado.
          </p>
        )}
      </section>
    );
  };

  if (supplierDetail?.link && typeof onUpdateClientDebtLedger === 'function') {
    return (
      <ClientSupplierDebtDetail
        user={user}
        showToast={showToast}
        link={supplierDetail.link}
        headingName={supplierDetail.headingName}
        clientDebtLedger={clientDebtLedger}
        ledgerReferenceDate={refDate}
        displayMoney={displayMoney}
        onUpdateClientDebtLedger={onUpdateClientDebtLedger}
        onClose={() => {
          setSupplierDetail(null);
          void loadRequests();
        }}
        requests={requests}
        onReloadRequests={loadRequests}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className={`${sectionCardClass} border-primary/25`}>
        <h3 className="text-base font-semibold text-content">Minhas dívidas locais</h3>
        <p className="mt-2 text-xs leading-relaxed text-content-muted">
          Registro opcional neste aparelho, separado da plataforma.{' '}
          <span className="font-medium text-content-soft">
            Não sincroniza com o fornecedor nem substitui o controle dele.
          </span>{' '}
          Um pedido aprovado na plataforma{' '}
          <span className="font-medium text-content-soft">não cria dívida aqui automaticamente</span>.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-content-muted">
          Os totais abaixo somam todo o livro local neste escopo (podem incluir fornecedores que não
          aparecem na lista de vínculos atuais). Cada fornecedor mostra o recorte daquele vínculo.
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-design-md border border-edge bg-surface-muted/60 px-3 py-2">
            <dt className="text-content-muted">Principal (posição no livro)</dt>
            <dd className="mt-0.5 text-base font-semibold text-content">
              {displayMoney(globalTotals.openPrincipal)}
            </dd>
          </div>
          <div className="rounded-design-md border border-edge bg-surface-muted/60 px-3 py-2">
            <dt className="text-content-muted">Juros estimados (mês)</dt>
            <dd className="mt-0.5 text-base font-semibold text-content">
              {displayMoney(globalTotals.estimatedMonthlyInterest)}
            </dd>
          </div>
          <div className="rounded-design-md border border-edge bg-surface-muted/60 px-3 py-2">
            <dt className="text-content-muted">Quitação estimada</dt>
            <dd className="mt-0.5 text-base font-semibold text-content">
              {displayMoney(globalTotals.estimatedSettlement)}
            </dd>
          </div>
          <div className="rounded-design-md border border-edge bg-surface-muted/60 px-3 py-2">
            <dt className="text-content-muted">Fornecedores com dívida ativa (local)</dt>
            <dd className="mt-0.5 text-base font-semibold text-content">
              {globalTotals.suppliersWithOpenDebt}
            </dd>
          </div>
        </dl>
      </div>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-edge" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-base px-3 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
            Plataforma — vínculos e pedidos remotos
          </span>
        </div>
      </div>

      <div className={sectionCardClass}>
        <h3 className="mb-2 text-base font-semibold text-content">Visão por fornecedor</h3>
        <p className="text-xs leading-relaxed text-content-muted">
          Acompanhe cada fornecedor com quem você tem vínculo aprovado na plataforma e os pedidos
          pré-financeiros enviados por fornecedor. Isso complementa —{' '}
          <span className="font-medium text-content-soft">não substitui</span> — sua lista em{' '}
          <span className="font-medium text-content-soft">Solicitações</span>.
        </p>
        {typeof onOpenSolicitations === 'function' ? (
          <button
            type="button"
            onClick={onOpenSolicitations}
            className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface-muted px-3 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            Ir para Solicitações (ações nos pedidos)
          </button>
        ) : null}
      </div>

      <div className={sectionCardClass}>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-content">Fornecedores vinculados</h3>
          <button
            type="button"
            onClick={() => void loadRequests()}
            disabled={requestsLoading}
            className="inline-flex min-h-[40px] items-center justify-center rounded-design-md border border-edge bg-surface-muted px-3 text-xs font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 disabled:opacity-60"
          >
            {requestsLoading ? 'Atualizando pedidos…' : 'Atualizar pedidos'}
          </button>
        </div>
        <p className="mb-4 text-[11px] leading-relaxed text-content-muted">
          Relação <span className="font-medium text-content-soft">apenas na plataforma</span>. Clientes,
          contratos e pagamentos que você usa no dia a dia continuam{' '}
          <span className="font-medium text-content-soft">locais neste aparelho</span>.
        </p>

        {requestsError ? (
          <div className="mb-4 rounded-design-md border border-edge bg-danger-soft px-4 py-3" role="alert">
            <p className="text-sm font-semibold leading-snug text-danger">{requestsError}</p>
          </div>
        ) : null}

        {linksLoading ? (
          <p className="text-center text-sm text-content-muted">Carregando vínculos…</p>
        ) : sortedApprovedLinks.length === 0 && orphanSupplierIds.length === 0 ? (
          <p className="text-sm leading-relaxed text-content-muted">
            Nenhum fornecedor com vínculo aprovado. Peça o vínculo em Conta → Vínculos e aguarde a
            aprovação antes de enviar pedidos pré-financeiros.
          </p>
        ) : (
          <div className="space-y-5">
            {sortedApprovedLinks.map((link) =>
              renderSupplierSection(
                link,
                typeof link.supplierId === 'string' ? link.supplierId : '',
                deriveApprovedLinkSupplierFriendlyName(link, supplierDisplayNames[link.supplierId]),
              ),
            )}
            {orphanSupplierIds.map((sid) => {
              const first = groupedBySupplier[sid]?.[0];
              const heading = deriveLoanRequestSupplierFriendlyName(
                first ?? { supplierId: sid },
                supplierDisplayNames[sid],
              );
              return renderSupplierSection(null, sid, heading);
            })}
          </div>
        )}
      </div>

    </div>
  );
}
