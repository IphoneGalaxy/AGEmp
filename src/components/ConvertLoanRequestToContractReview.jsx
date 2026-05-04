import React, { useEffect, useState } from 'react';

import { formatMoney, formatRate } from '../utils/format';
import {
  approvedAmountCentsToReaisOrNull,
  deriveLoanRequestClientDisplayLabel,
} from '../utils/convertLoanRequestReviewDerive';

/**
 * Modal de revisão da conversão governada (Bloco2-B).
 * Não persiste contrato nem altera dados financeiros — apenas UI e confirmação explícita.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {Record<string, unknown> | null} props.request — linha do painel fornecedor (`approved`).
 * @param {number} props.defaultInterestRate — taxa sugerida (%), mesma base que novos contratos manuais.
 * @param {() => void} props.onClose
 * @param {(msg: string) => void} [props.showToast]
 */
export default function ConvertLoanRequestToContractReview({
  open,
  request,
  defaultInterestRate,
  onClose,
  showToast,
}) {
  const [transferConfirmed, setTransferConfirmed] = useState(false);

  useEffect(() => {
    if (open) setTransferConfirmed(false);
  }, [open, request?.id]);

  if (!open || !request) return null;

  const approvedReais = approvedAmountCentsToReaisOrNull(request.approvedAmount);
  const amountLabel =
    approvedReais != null ? formatMoney(approvedReais) : '— (valor aprovado indisponível)';
  const clientLabel = deriveLoanRequestClientDisplayLabel(request.clientId);
  const suggestedDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const rateNum =
    typeof defaultInterestRate === 'number' && Number.isFinite(defaultInterestRate)
      ? defaultInterestRate
      : 10;

  const handleConfirmPlaceholder = () => {
    showToast?.('A criação do contrato local será implementada na próxima etapa.');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="convert-loan-request-review-title"
      onClick={onClose}
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
          Revise os dados antes de qualquer registro no livro caixa deste aparelho. O pedido na
          plataforma continua sendo apenas pré-financeiro.
        </p>

        <dl className="mt-4 space-y-3 rounded-design-md border border-edge/70 bg-surface-muted/50 px-3 py-3">
          <div>
            <dt className="text-xs font-medium text-content-muted">Valor aprovado (pedido)</dt>
            <dd className="text-sm font-semibold tabular-nums text-content">{amountLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-content-muted">Cliente (identificação)</dt>
            <dd className="text-sm text-content-soft">{clientLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-content-muted">Data sugerida para o contrato</dt>
            <dd className="text-sm text-content-soft">{suggestedDate}</dd>
            <p className="mt-1 text-[11px] leading-relaxed text-content-muted">
              Corresponde à data de hoje neste aparelho; o registro efetivo só ocorrerá quando a
              próxima etapa persistir o contrato.
            </p>
          </div>
          <div>
            <dt className="text-xs font-medium text-content-muted">Taxa de juros sugerida (%)</dt>
            <dd className="text-sm font-medium tabular-nums text-content-soft">{formatRate(rateNum)}</dd>
            <p className="mt-1 text-[11px] leading-relaxed text-content-muted">
              Pré-preenchimento com a taxa padrão das suas configurações (como em novo contrato
              manual). Ajustes finos ficam para a próxima etapa.
            </p>
          </div>
          {typeof request.id === 'string' && request.id.length > 0 ? (
            <div>
              <dt className="text-xs font-medium text-content-muted">ID do pedido (plataforma)</dt>
              <dd className="break-all font-mono text-[11px] text-content-muted">{request.id}</dd>
            </div>
          ) : null}
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
            onChange={(e) => setTransferConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-edge text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          />
          <span className="text-sm leading-snug text-content-soft">
            A transferência real já foi feita?
          </span>
        </label>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface-muted px-4 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring sm:w-auto"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!transferConfirmed}
            onClick={handleConfirmPlaceholder}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md bg-primary px-4 text-sm font-semibold text-content-inverse shadow-design-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Registrar contrato
          </button>
        </div>
      </div>
    </div>
  );
}
