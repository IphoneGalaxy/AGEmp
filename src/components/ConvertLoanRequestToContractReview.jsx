import React, { useEffect, useState } from 'react';

import { formatMoney, formatRate } from '../utils/format';
import {
  approvedAmountCentsToReaisOrNull,
  deriveLoanRequestConversionReviewClientLabel,
} from '../utils/convertLoanRequestReviewDerive';
import {
  applyApprovedLoanRequestConversion,
  hasConvertedLoanRequestDuplicate,
  todayIsoDateLocal,
} from '../utils/convertLoanRequestToLocalContract';
import { findLoanRequestConversionRegistryEntry } from '../utils/loanRequestConversionRegistry';
import { generateId } from '../utils/ids';

/**
 * Modal de revisão da conversão governada (Bloco2-B + persistência Bloco2-C).
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {Record<string, unknown> | null} props.request — linha do painel fornecedor (`approved`).
 * @param {number} props.defaultInterestRate — taxa sugerida (%), mesma base que novos contratos manuais.
 * @param {unknown[]} props.clients — snapshot financeiro local (escopo atual).
 * @param {unknown[]} [props.conversionRegistry]
 * @param {(entry: Record<string, unknown>) => void} [props.onUpsertConversionRegistry]
 * @param {(updater: (prev: unknown[]) => unknown[]) => void} props.onUpdateClients — mesmo contrato que ClientView.
 * @param {() => void} props.onClose
 * @param {(msg: string) => void} [props.showToast]
 */
export default function ConvertLoanRequestToContractReview({
  open,
  request,
  defaultInterestRate,
  clients,
  conversionRegistry = [],
  onUpsertConversionRegistry,
  onUpdateClients,
  onClose,
  showToast,
}) {
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const [reconversionConfirmed, setReconversionConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTransferConfirmed(false);
      setReconversionConfirmed(false);
      setSubmitting(false);
    }
  }, [open, request?.id]);

  if (!open || !request) return null;

  const approvedReais = approvedAmountCentsToReaisOrNull(request.approvedAmount);
  const amountLabel =
    approvedReais != null ? formatMoney(approvedReais) : '— (valor aprovado indisponível)';
  const clientLabel = deriveLoanRequestConversionReviewClientLabel(request);
  const suggestedDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const rateNum =
    typeof defaultInterestRate === 'number' && Number.isFinite(defaultInterestRate)
      ? defaultInterestRate
      : 10;

  const list = Array.isArray(clients) ? clients : [];
  const reqId = typeof request.id === 'string' ? request.id.trim() : '';
  const historicalReconversion =
    !!reqId &&
    !!findLoanRequestConversionRegistryEntry(conversionRegistry, reqId) &&
    !hasConvertedLoanRequestDuplicate(list, reqId);

  const handleConfirm = () => {
    if (!transferConfirmed || submitting) return;
    if (historicalReconversion && !reconversionConfirmed) {
      showToast?.('Confirme também a reconversão para continuar.');
      return;
    }
    if (typeof onUpdateClients !== 'function') {
      showToast?.('Não foi possível atualizar os dados locais.');
      return;
    }

    if (reqId && hasConvertedLoanRequestDuplicate(list, reqId)) {
      showToast?.('Este pedido já foi registrado como contrato local neste aparelho.');
      return;
    }

    setSubmitting(true);
    try {
      const loanId = generateId();
      const newClientId = generateId();
      const conversionDateIso = todayIsoDateLocal();

      const result = applyApprovedLoanRequestConversion({
        clients: list,
        request,
        interestRate: rateNum,
        loanId,
        newClientId,
        conversionDateIso,
      });

      if (!result.ok) {
        showToast?.(result.message);
        return;
      }

      onUpdateClients(() => result.nextClients);
      if (typeof onUpsertConversionRegistry === 'function' && result.registryEntry) {
        onUpsertConversionRegistry(result.registryEntry);
      }
      showToast?.('Contrato registrado localmente a partir do pedido na plataforma.');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    transferConfirmed && (!historicalReconversion || reconversionConfirmed) && !submitting;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="convert-loan-request-review-title"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-design-lg border border-edge bg-surface p-5 shadow-design-md sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="convert-loan-request-review-title"
          className="text-lg font-semibold tracking-tight text-content"
        >
          Registrar contrato local
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-content-muted">
          Revise os dados antes de gravar no livro caixa deste aparelho. O pedido na plataforma continua
          sendo apenas pré-financeiro.
        </p>

        {historicalReconversion ? (
          <div
            className="mt-4 rounded-design-md border border-warning/40 bg-warning/10 px-3 py-2.5"
            role="status"
          >
            <p className="text-xs font-semibold leading-snug text-content-soft">
              Reconversão após contrato apagado
            </p>
            <p className="mt-2 text-xs leading-relaxed text-content-muted">
              Este pedido já foi registrado localmente antes, mas o contrato foi apagado deste aparelho.
              Registrar de novo cria um novo contrato local — só faça se for adequado à sua operação.
            </p>
          </div>
        ) : null}

        <dl className="mt-4 space-y-3 rounded-design-md border border-edge/70 bg-surface-muted/50 px-3 py-3">
          <div>
            <dt className="text-xs font-medium text-content-muted">Valor aprovado (pedido)</dt>
            <dd className="text-sm font-semibold tabular-nums text-content">{amountLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-content-muted">Cliente</dt>
            <dd className="text-sm text-content-soft">{clientLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-content-muted">Data do contrato (registro)</dt>
            <dd className="text-sm text-content-soft">{suggestedDate}</dd>
            <p className="mt-1 text-[11px] leading-relaxed text-content-muted">
              Usa a data de hoje neste aparelho no momento em que você confirma o registro (conforme
              decisão de produto D6).
            </p>
          </div>
          <div>
            <dt className="text-xs font-medium text-content-muted">Taxa de juros (%)</dt>
            <dd className="text-sm font-medium tabular-nums text-content-soft">{formatRate(rateNum)}</dd>
            <p className="mt-1 text-[11px] leading-relaxed text-content-muted">
              Igual à taxa padrão das suas configurações (como em novo contrato manual nesta versão).
            </p>
          </div>
        </dl>

        <div
          className="mt-4 rounded-design-md border border-warning/35 bg-warning/10 px-3 py-2.5"
          role="status"
        >
          <p className="text-xs font-semibold leading-snug text-content-soft">
            Este aplicativo não transfere dinheiro
          </p>
          <p className="mt-1 text-xs leading-relaxed text-content-muted">
            Ele apenas ajuda a registar operações que você declara já ter realizado fora do app.
            Não valida conta bancária nem saldo real — use seus próprios meios para conferir a
            transferência.
          </p>
        </div>

        <label className="mt-4 flex cursor-pointer gap-3 rounded-design-md border border-edge bg-surface-muted/40 px-3 py-3">
          <input
            type="checkbox"
            checked={transferConfirmed}
            disabled={submitting}
            onChange={(e) => setTransferConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-edge text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-50"
          />
          <span className="text-sm leading-snug text-content-soft">
            A transferência real já foi feita?
          </span>
        </label>

        {historicalReconversion ? (
          <label className="mt-3 flex cursor-pointer gap-3 rounded-design-md border border-edge border-warning/35 bg-warning/5 px-3 py-3">
            <input
              type="checkbox"
              checked={reconversionConfirmed}
              disabled={submitting}
              onChange={(e) => setReconversionConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-edge text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-50"
            />
            <span className="text-sm leading-snug text-content-soft">
              Entendo que estou registrando de novo neste aparelho após um contrato local anterior ter sido
              apagado, e que isso não altera vínculos nem pedidos na plataforma.
            </span>
          </label>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface-muted px-4 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-50 sm:w-auto"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleConfirm}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md bg-primary px-4 text-sm font-semibold text-content-inverse shadow-design-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {submitting ? 'Registrando…' : 'Registrar contrato'}
          </button>
        </div>
      </div>
    </div>
  );
}
