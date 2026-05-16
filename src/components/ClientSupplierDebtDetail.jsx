import React, { useCallback, useMemo, useState } from 'react';

import { formatMoney } from '../utils/format';
import { parseBrlMoneyInputToCents, normalizeNoteForLoanRequest } from '../utils/brlMoneyInput';
import { mapFirestoreError } from '../firebase/firestoreErrors';
import {
  createLoanRequest,
  findOpenLoanRequestForLinkId,
} from '../firebase/loanRequestsFirestore';
import {
  LOAN_REQUEST_MAX_AMOUNT_CENTS,
  LOAN_REQUEST_MAX_NOTE_CHARS,
  LOAN_REQUEST_MIN_AMOUNT_CENTS,
  LOAN_REQUEST_STATUSES,
  getLoanRequestStatusLabelPt,
} from '../firebase/loanRequests';
import {
  appendDebtToSupplierLedger,
  appendPaymentToDebt,
  appendSupplierToLedgerIfMissing,
  CLIENT_DEBT_LINK_APPROVED_STATUS,
  createDebtDraftFromApprovedLoanRequest,
  createManualDebtDraft,
  createSupplierFromApprovedLink,
  DEBT_STATUS,
  deriveDebtSnapshot,
  findSupplierEntry,
  normalizeClientDebtLedger,
  normalizeIsoDateString,
  updateDebtStatusInLedger,
  validateMinimumDebtForCommit,
} from '../utils/clientDebtLedger';

const cardClass =
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

function debtStatusLabelPt(status) {
  if (status === DEBT_STATUS.ACTIVE) return 'Ativa';
  if (status === DEBT_STATUS.SETTLED_LOCALLY) return 'Quitada localmente';
  if (status === DEBT_STATUS.ARCHIVED) return 'Arquivada';
  return String(status);
}

/**
 * Detalhe do fornecedor na aba Fornecedores — dívidas/pagamentos locais + pedidos remotos.
 *
 * @param {Object} props
 * @param {import('firebase/auth').User | null} props.user
 * @param {(msg: string) => void} [props.showToast]
 * @param {Object} props.link — vínculo aprovado (id, supplierId, clientId, status)
 * @param {string} props.headingName — nome amigável do fornecedor
 * @param {import('../utils/clientDebtLedger').ClientDebtLedger} props.clientDebtLedger
 * @param {Date} props.ledgerReferenceDate
 * @param {(n: number) => string} props.displayMoney
 * @param {(updater: (prev: import('../utils/clientDebtLedger').ClientDebtLedger) => import('../utils/clientDebtLedger').ClientDebtLedger) => void} props.onUpdateClientDebtLedger
 * @param {() => void} props.onClose
 * @param {Array} props.requests — loanRequests do cliente (lista completa; filtramos aqui)
 * @param {() => void | Promise<void>} props.onReloadRequests
 */
export default function ClientSupplierDebtDetail({
  user,
  showToast,
  link,
  headingName,
  clientDebtLedger,
  ledgerReferenceDate,
  displayMoney: displayMoneyProp,
  onUpdateClientDebtLedger,
  onClose,
  requests,
  onReloadRequests,
}) {
  const displayMoney =
    typeof displayMoneyProp === 'function' ? displayMoneyProp : (n) => formatMoney(n);

  const refDate = useMemo(() => {
    const d = ledgerReferenceDate;
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : new Date();
  }, [ledgerReferenceDate]);

  const ledgerNorm = useMemo(() => normalizeClientDebtLedger(clientDebtLedger), [clientDebtLedger]);

  const supplierId = typeof link?.supplierId === 'string' ? link.supplierId.trim() : '';
  const linkId = typeof link?.id === 'string' ? link.id.trim() : '';

  const supplierEntry = useMemo(
    () => findSupplierEntry(ledgerNorm, supplierId, linkId),
    [ledgerNorm, supplierId, linkId],
  );

  const debts = useMemo(() => {
    const list = supplierEntry?.debts ? [...supplierEntry.debts] : [];
    list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return list;
  }, [supplierEntry]);

  const platformRequests = useMemo(() => {
    const sid = supplierId;
    const lid = linkId;
    return (requests ?? []).filter((r) => {
      if (typeof r?.supplierId !== 'string' || r.supplierId.trim() !== sid) return false;
      if (typeof r?.linkId === 'string' && r.linkId.trim()) {
        return r.linkId.trim() === lid;
      }
      return true;
    });
  }, [requests, supplierId, linkId]);

  const approvedForPrefill = useMemo(
    () => platformRequests.filter((r) => r?.status === LOAN_REQUEST_STATUSES.APPROVED),
    [platformRequests],
  );

  const [manualPrincipal, setManualPrincipal] = useState('');
  const [manualRate, setManualRate] = useState('10');
  const [manualStart, setManualStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualNote, setManualNote] = useState('');
  const [manualError, setManualError] = useState('');

  const [prefillDraft, setPrefillDraft] = useState(null);
  const [prefillConfirm, setPrefillConfirm] = useState(false);
  const [prefillError, setPrefillError] = useState('');

  const [payDebtId, setPayDebtId] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState('');
  const [payError, setPayError] = useState('');

  const [solAmount, setSolAmount] = useState('');
  const [solNote, setSolNote] = useState('');
  const [solError, setSolError] = useState('');
  const [solSubmitting, setSolSubmitting] = useState(false);

  const hasLocalDebtForLoanRequest = useCallback(
    (lrId) => {
      const id = typeof lrId === 'string' ? lrId.trim() : '';
      if (!id || !supplierEntry?.debts) return false;
      return supplierEntry.debts.some((d) => d.loanRequestId === id);
    },
    [supplierEntry],
  );

  const handleCreateManualDebt = useCallback(() => {
    setManualError('');
    const parsed = parseBrlMoneyInputToCents(manualPrincipal, { minCents: 1 });
    if (!parsed.ok) {
      setManualError(parsed.message);
      return;
    }
    const principalReais = parsed.cents / 100;
    const rateNum = Number(String(manualRate).replace(',', '.'));
    const interestRate = Number.isFinite(rateNum) ? rateNum : 10;
    const startDate = normalizeIsoDateString(manualStart) || new Date().toISOString().slice(0, 10);
    const draft = createManualDebtDraft({
      principalAmount: principalReais,
      interestRate,
      startDate,
      localNote: manualNote.trim(),
    });
    const v = validateMinimumDebtForCommit(draft);
    if (!v.ok) {
      setManualError(v.message);
      return;
    }
    onUpdateClientDebtLedger((prev) => {
      let L = normalizeClientDebtLedger(prev);
      const sup = createSupplierFromApprovedLink(
        {
          id: linkId,
          supplierId,
          clientId: user?.uid,
          status: CLIENT_DEBT_LINK_APPROVED_STATUS,
        },
        { displayNameSnapshot: headingName },
      );
      if (!sup) return L;
      L = appendSupplierToLedgerIfMissing(L, sup);
      return appendDebtToSupplierLedger(L, supplierId, linkId, draft);
    });
    setManualPrincipal('');
    setManualNote('');
    showToast?.('Dívida local registrada neste aparelho.');
  }, [
    headingName,
    linkId,
    manualNote,
    manualPrincipal,
    manualRate,
    manualStart,
    onUpdateClientDebtLedger,
    showToast,
    supplierId,
    user?.uid,
  ]);

  const beginPrefill = useCallback(
    (loanRequest) => {
      setPrefillError('');
      setPrefillConfirm(false);
      const draft = createDebtDraftFromApprovedLoanRequest(loanRequest, link, {
        interestRate: 10,
        startDate: new Date().toISOString().slice(0, 10),
      });
      if (!draft) {
        setPrefillError('Só é possível usar pedidos aprovados como base.');
        return;
      }
      if (hasLocalDebtForLoanRequest(loanRequest.id)) {
        setPrefillError('Já existe uma dívida local vinculada a este pedido.');
        return;
      }
      setPrefillDraft(draft);
    },
    [hasLocalDebtForLoanRequest, link],
  );

  const commitPrefill = useCallback(() => {
    if (!prefillDraft || !prefillConfirm) {
      setPrefillError('Marque a confirmação para criar o registro local.');
      return;
    }
    const v = validateMinimumDebtForCommit(prefillDraft);
    if (!v.ok) {
      setPrefillError(v.message);
      return;
    }
    onUpdateClientDebtLedger((prev) => {
      let L = normalizeClientDebtLedger(prev);
      const sup = createSupplierFromApprovedLink(
        {
          id: linkId,
          supplierId,
          clientId: user?.uid,
          status: CLIENT_DEBT_LINK_APPROVED_STATUS,
        },
        { displayNameSnapshot: headingName },
      );
      if (!sup) return L;
      L = appendSupplierToLedgerIfMissing(L, sup);
      return appendDebtToSupplierLedger(L, supplierId, linkId, prefillDraft);
    });
    setPrefillDraft(null);
    setPrefillConfirm(false);
    showToast?.('Dívida local criada a partir do pedido (somente neste aparelho).');
  }, [
    headingName,
    linkId,
    onUpdateClientDebtLedger,
    prefillConfirm,
    prefillDraft,
    showToast,
    supplierId,
    user?.uid,
  ]);

  const handleAppendPayment = useCallback(
    (debtId) => {
      setPayError('');
      const parsed = parseBrlMoneyInputToCents(payAmount, { minCents: 1 });
      if (!parsed.ok) {
        setPayError(parsed.message);
        return;
      }
      const amountReais = parsed.cents / 100;
      const date = normalizeIsoDateString(payDate);
      if (!date) {
        setPayError('Informe a data do pagamento (AAAA-MM-DD).');
        return;
      }
      onUpdateClientDebtLedger((prev) =>
        appendPaymentToDebt(prev, supplierId, linkId, debtId, {
          date,
          amount: amountReais,
          note: payNote.trim().slice(0, 2000),
          source: 'manual',
        }),
      );
      setPayAmount('');
      setPayNote('');
      setPayDebtId(null);
      showToast?.('Pagamento local registrado.');
    },
    [linkId, onUpdateClientDebtLedger, payAmount, payDate, payNote, showToast, supplierId],
  );

  const handleArchiveDebt = useCallback(
    (debtId) => {
      if (!window.confirm('Arquivar esta dívida local? Ela deixa de entrar nos totais ativos.')) {
        return;
      }
      onUpdateClientDebtLedger((prev) =>
        updateDebtStatusInLedger(prev, supplierId, linkId, debtId, DEBT_STATUS.ARCHIVED),
      );
      showToast?.('Dívida arquivada localmente.');
    },
    [linkId, onUpdateClientDebtLedger, showToast, supplierId],
  );

  const handleSubmitSolicitation = useCallback(async () => {
    if (!user?.uid || !linkId) return;
    setSolError('');
    const parsed = parseBrlMoneyInputToCents(solAmount, {
      minCents: LOAN_REQUEST_MIN_AMOUNT_CENTS,
      maxCents: LOAN_REQUEST_MAX_AMOUNT_CENTS,
    });
    if (!parsed.ok) {
      setSolError(parsed.message);
      return;
    }
    const note = normalizeNoteForLoanRequest(solNote, LOAN_REQUEST_MAX_NOTE_CHARS);
    setSolSubmitting(true);
    try {
      const dup = await findOpenLoanRequestForLinkId(linkId, user.uid);
      if (dup.exists) {
        setSolError(
          'Já existe um pedido em aberto para este fornecedor. Aguarde resposta ou cancele o pedido anterior.',
        );
        return;
      }
      const result = await createLoanRequest({
        supplierId,
        clientId: user.uid,
        linkId,
        requestedAmountCents: parsed.cents,
        clientNote: note,
      });
      if (result.ok) {
        showToast?.('Pedido enviado na plataforma (pré-financeiro).');
        setSolAmount('');
        setSolNote('');
        await onReloadRequests?.();
      } else {
        setSolError(result.message);
      }
    } catch (e) {
      setSolError(mapFirestoreError(e));
    } finally {
      setSolSubmitting(false);
    }
  }, [linkId, onReloadRequests, showToast, solAmount, solNote, supplierId, user?.uid]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="mb-2 text-xs font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            ← Voltar à lista de fornecedores
          </button>
          <h2 className="text-lg font-semibold tracking-tight text-content">{headingName}</h2>
          <p className="mt-1 text-xs text-content-muted">Vínculo aprovado na plataforma (conta ↔ conta).</p>
        </div>
      </div>

      <div className="rounded-design-md border border-primary/30 bg-primary-soft/25 px-4 py-3 text-xs leading-relaxed text-content-soft">
        <p className="font-medium text-content">
          Estes dados são locais neste aparelho e não sincronizam com o fornecedor.
        </p>
        <p className="mt-2">
          Registrar aqui não altera o controle do fornecedor. Pedido aprovado na plataforma não cria
          dívida local automaticamente.
        </p>
      </div>

      <section className={`${cardClass} border-primary/20`}>
        <h3 className="text-base font-semibold text-content">Minhas dívidas locais</h3>
        <p className="mt-2 text-xs leading-relaxed text-content-muted">
          O que você registra abaixo fica só no seu financeiro local, neste escopo — não envia
          valores ao fornecedor nem substitui o cadastro dele.
        </p>

        {debts.length === 0 ? (
          <p className="mt-4 text-sm text-content-muted">
            Nenhuma dívida local ainda. Crie uma manualmente ou use um pedido aprovado como base
            (com confirmação), na seção de pedidos abaixo.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {debts.map((debt) => {
              const snap = deriveDebtSnapshot(debt, refDate);
              return (
                <li
                  key={debt.id}
                  className="rounded-design-md border border-edge bg-surface-muted/50 px-3 py-3 sm:px-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-content">
                      Principal inicial {displayMoney(debt.principalAmount)}
                    </p>
                    <span className="rounded-design-sm bg-surface px-2 py-0.5 text-[11px] font-medium text-content-soft">
                      {debtStatusLabelPt(debt.status)}
                    </span>
                  </div>
                  <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-content-muted">Saldo principal (local)</dt>
                      <dd className="font-semibold text-content">{displayMoney(snap.currentPrincipal)}</dd>
                    </div>
                    <div>
                      <dt className="text-content-muted">Juros estimados (mês)</dt>
                      <dd className="font-semibold text-content">
                        {displayMoney(snap.estimatedMonthlyInterest)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-content-muted">Quitação estimada</dt>
                      <dd className="font-semibold text-content">
                        {displayMoney(snap.estimatedSettlement)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-content-muted">Data inicial</dt>
                      <dd className="font-semibold text-content">{debt.startDate}</dd>
                    </div>
                  </dl>
                  {debt.localNote ? (
                    <p className="mt-2 text-[11px] text-content-muted">Obs.: {debt.localNote}</p>
                  ) : null}

                  {debt.payments.length > 0 ? (
                    <div className="mt-3 border-t border-edge pt-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-content-muted">
                        Pagamentos locais
                      </p>
                      <ul className="mt-1 space-y-1">
                        {debt.payments.map((p) => (
                          <li key={p.id} className="text-[11px] text-content-soft">
                            {p.date} · {displayMoney(p.amount)}
                            {p.note ? ` · ${p.note}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {debt.status === DEBT_STATUS.ACTIVE ? (
                    <div className="mt-3 border-t border-edge pt-3">
                      {payDebtId === debt.id ? (
                        <div className="space-y-2">
                          {payError ? (
                            <p className="text-xs font-medium text-danger" role="alert">
                              {payError}
                            </p>
                          ) : null}
                          <label className="block text-[11px] font-medium text-content-soft">
                            Valor (R$)
                            <input
                              type="text"
                              inputMode="decimal"
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              className="mt-1 min-h-[44px] w-full rounded-design-md border border-edge bg-surface px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="block text-[11px] font-medium text-content-soft">
                            Data
                            <input
                              type="date"
                              value={payDate}
                              onChange={(e) => setPayDate(e.target.value)}
                              className="mt-1 min-h-[44px] w-full rounded-design-md border border-edge bg-surface px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="block text-[11px] font-medium text-content-soft">
                            Observação (opcional)
                            <input
                              type="text"
                              value={payNote}
                              onChange={(e) => setPayNote(e.target.value)}
                              className="mt-1 min-h-[44px] w-full rounded-design-md border border-edge bg-surface px-3 py-2 text-sm"
                            />
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleAppendPayment(debt.id)}
                              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-design-md bg-primary px-3 text-sm font-semibold text-content-inverse"
                            >
                              Salvar pagamento
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPayDebtId(null);
                                setPayError('');
                              }}
                              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-design-md border border-edge px-3 text-sm font-semibold text-content-soft"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPayDebtId(debt.id);
                              setPayAmount('');
                              setPayDate(new Date().toISOString().slice(0, 10));
                              setPayNote('');
                              setPayError('');
                            }}
                            className="inline-flex min-h-[40px] items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-xs font-semibold text-content-soft"
                          >
                            Registrar pagamento local
                          </button>
                          {debt.status === DEBT_STATUS.ACTIVE ? (
                            <button
                              type="button"
                              onClick={() => handleArchiveDebt(debt.id)}
                              className="inline-flex min-h-[40px] items-center justify-center rounded-design-md border border-edge px-3 text-xs font-semibold text-content-muted"
                            >
                              Arquivar dívida
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-6 border-t border-edge pt-4">
          <h4 className="text-sm font-semibold text-content">Nova dívida manual</h4>
          {manualError ? (
            <p className="mt-2 text-xs font-medium text-danger" role="alert">
              {manualError}
            </p>
          ) : null}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-content-soft">
              Valor principal (R$)
              <input
                type="text"
                inputMode="decimal"
                value={manualPrincipal}
                onChange={(e) => setManualPrincipal(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-design-md border border-edge bg-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-content-soft">
              Taxa % ao mês
              <input
                type="text"
                value={manualRate}
                onChange={(e) => setManualRate(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-design-md border border-edge bg-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-content-soft sm:col-span-2">
              Data inicial
              <input
                type="date"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-design-md border border-edge bg-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-content-soft sm:col-span-2">
              Observação (opcional)
              <textarea
                rows={2}
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                className="mt-1 w-full rounded-design-md border border-edge bg-surface px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={handleCreateManualDebt}
            className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md bg-primary px-4 text-sm font-semibold text-content-inverse"
          >
            Criar dívida local
          </button>
        </div>
      </section>

      <section className={`${cardClass} border-edge`}>
        <h3 className="text-base font-semibold text-content">Pedidos na plataforma</h3>
        <p className="mt-2 text-xs leading-relaxed text-content-muted">
          Pré-financeiro remoto — não altera dívidas locais automaticamente.
        </p>

        {prefillDraft ? (
          <div className="mt-4 rounded-design-md border border-primary/30 bg-primary-soft/20 p-4">
            <p className="text-sm font-semibold text-content">Confirmar registro local</p>
            <p className="mt-2 text-xs leading-relaxed text-content-muted">
              Isto cria apenas um registro neste aparelho. Não sincroniza com o fornecedor nem
              substitui o controle dele.
            </p>
            {prefillError ? (
              <p className="mt-2 text-xs font-medium text-danger" role="alert">
                {prefillError}
              </p>
            ) : null}
            <ul className="mt-3 space-y-1 text-xs text-content-soft">
              <li>Principal sugerido: {displayMoney(prefillDraft.principalAmount)}</li>
              <li>Taxa: {prefillDraft.interestRate}% ao mês</li>
              <li>Início: {prefillDraft.startDate}</li>
            </ul>
            <label className="mt-4 flex cursor-pointer items-start gap-2 text-xs text-content-soft">
              <input
                type="checkbox"
                checked={prefillConfirm}
                onChange={(e) => setPrefillConfirm(e.target.checked)}
                className="mt-0.5"
              />
              <span>Entendo que isto é só no meu aparelho e não altera o fornecedor.</span>
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={commitPrefill}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-design-md bg-primary px-3 text-sm font-semibold text-content-inverse"
              >
                Confirmar e criar
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrefillDraft(null);
                  setPrefillConfirm(false);
                  setPrefillError('');
                }}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-design-md border border-edge px-3 text-sm font-semibold text-content-soft"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        <ul className="mt-4 space-y-2">
          {platformRequests.length === 0 ? (
            <li className="text-sm text-content-muted">Nenhum pedido para este fornecedor.</li>
          ) : (
            platformRequests.map((r) => {
              const requestedMoney =
                typeof r.requestedAmount === 'number' ? formatMoney(r.requestedAmount / 100) : '—';
              const statusLabel = getLoanRequestStatusLabelPt(r.status);
              const canPrefill =
                r.status === LOAN_REQUEST_STATUSES.APPROVED && !hasLocalDebtForLoanRequest(r.id);

              return (
                <li
                  key={r.id}
                  className="rounded-design-md border border-edge bg-surface-muted px-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-semibold text-content">{requestedMoney}</span>
                    <span className="text-content-soft">{statusLabel}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-content-muted">
                    Enviado em {formatRequestTimestamp(r.createdAt)}
                  </p>
                  {canPrefill ? (
                    <button
                      type="button"
                      onClick={() => beginPrefill(r)}
                      className="mt-2 inline-flex min-h-[40px] w-full items-center justify-center rounded-design-md border border-primary/40 bg-surface px-2 text-xs font-semibold text-primary"
                    >
                      Usar pedido aprovado como base no financeiro local
                    </button>
                  ) : null}
                  {r.status === LOAN_REQUEST_STATUSES.APPROVED && hasLocalDebtForLoanRequest(r.id) ? (
                    <p className="mt-2 text-[11px] text-content-muted">
                      Já existe dívida local vinculada a este pedido.
                    </p>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>

        <div className="mt-6 border-t border-edge pt-4">
          <h4 className="text-sm font-semibold text-content">Solicitar novo valor (plataforma)</h4>
          {solError ? (
            <p className="mt-2 text-xs font-medium text-danger" role="alert">
              {solError}
            </p>
          ) : null}
          <label className="mt-3 block text-xs font-medium text-content-soft">
            Valor (R$)
            <input
              type="text"
              inputMode="decimal"
              value={solAmount}
              onChange={(e) => setSolAmount(e.target.value)}
              disabled={solSubmitting}
              className="mt-1 min-h-[44px] w-full rounded-design-md border border-edge bg-surface px-3 py-2 text-sm disabled:opacity-60"
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-content-soft">
            Observação (opcional)
            <textarea
              rows={2}
              maxLength={LOAN_REQUEST_MAX_NOTE_CHARS}
              value={solNote}
              onChange={(e) => setSolNote(e.target.value)}
              disabled={solSubmitting}
              className="mt-1 w-full rounded-design-md border border-edge bg-surface px-3 py-2 text-sm disabled:opacity-60"
            />
          </label>
          <button
            type="button"
            disabled={solSubmitting}
            onClick={() => void handleSubmitSolicitation()}
            className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md bg-primary px-4 text-sm font-semibold text-content-inverse disabled:opacity-60"
          >
            {solSubmitting ? 'Enviando…' : 'Enviar pedido na plataforma'}
          </button>
        </div>
      </section>
    </div>
  );
}
